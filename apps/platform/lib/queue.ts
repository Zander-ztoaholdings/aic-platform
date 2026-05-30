import { Queue, Worker, Job } from 'bullmq';
import { getTenantDb, auditLogs, notifications, eq } from '@aic/db';
import { EngineClient } from './engine-client';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// BullMQ recommends sharing the connection, but to avoid version-mismatch type errors
// between different ioredis installations in the monorepo, we pass the URL string.
// BullMQ will handle the connection internally.
const connectionOptions = {
  connection: {
    url: REDIS_URL,
  }
};

export const engineQueue = new Queue('engine-tasks', {
  ...connectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
  },
});

export async function enqueueEngineTask(type: string, payload: Record<string, unknown>, auditId: string, orgId: string) {
  const job = await engineQueue.add(type, { type, payload, auditId, orgId });
  return job.id;
}

export const engineWorker = new Worker(
  'engine-tasks',
  async (job: Job) => {
    const { type, payload, auditId, orgId, taskId } = job.data;

    if (!taskId) {
      // 1. Initial trigger of Async Engine Task (Remediation P1)
      let res: { task_id: string; status: string };
      switch (type) {
        case 'disparate_impact':
          res = await EngineClient.triggerDisparateImpactAsync(orgId, payload.data as any[], payload.protected_attribute as string, payload.outcome_variable as string, payload.previous_hash as string);
          break;
        case 'equalized_odds':
          res = await EngineClient.triggerEqualizedOddsAsync(orgId, payload.data as any[], payload.protected_attribute as string, payload.actual_outcome as string, payload.predicted_outcome as string, payload.threshold as number, payload.previous_hash as string);
          break;
        case 'intersectional':
          res = await EngineClient.triggerIntersectionalAsync(orgId, payload.data as any[], payload.protected_attributes as string[], payload.outcome_variable as string, payload.min_group_size as number, payload.previous_hash as string);
          break;
        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      if (!res.task_id) throw new Error(`Engine trigger failed: ${JSON.stringify(res)}`);
      
      // Update job with taskId to enable polling in next attempt
      await job.updateData({ ...job.data, taskId: res.task_id });
      
      // Delay next attempt by throwing a specific error that causes BullMQ to retry
      // based on the exponential backoff defined in queue options.
      throw new Error('WAITING_FOR_ENGINE');
    } else {
      // 2. Poll for Status
      const res = await EngineClient.getTaskStatus(taskId, orgId);
      
      const { status, result } = res;
      
      if (status === 'SUCCESS' && result) {
        // [SECURITY] Result processing is RLS enforced via getTenantDb inside processEngineResult
        await processEngineResult(result as Record<string, unknown>, auditId, orgId);
        return result;
      } else if (status === 'FAILURE' || status === 'REVOKED') {
        const db = getTenantDb(orgId);
        await db.query(async (tx) => {
          await tx.update(auditLogs)
            .set({ 
                status: 'FLAGGED',
                details: { error: 'Engine task failed', status }
            })
            .where(eq(auditLogs.id, auditId));
        });
        throw new Error(`Engine task failed: ${status}`);
      } else {
        // Still processing (PENDING, STARTED, etc.)
        // We throw so BullMQ retries based on backoff
        throw new Error('STILL_PROCESSING');
      }
    }
  },
  {
    ...connectionOptions,
    concurrency: 5,
  }
);

interface ResourceUsage {
  compute_ms: number;
  memory_mb: number;
  carbon_estimate_g: number;
}

async function processEngineResult(result: Record<string, unknown>, auditId: string, orgId: string) {
    const db = getTenantDb(orgId);
    await db.query(async (tx) => {
      // Update Audit Log
      await tx.update(auditLogs)
        .set({
          details: result,
          integrityHash: (result.audit_hash as string) || null,
          signature: (result.signature as string) || null,
          resourceUsage: (result.resource_usage as ResourceUsage) || {
            compute_ms: 0,
            memory_mb: 0,
            carbon_estimate_g: 0
          },
          status: 'VERIFIED'
        })
        .where(eq(auditLogs.id, auditId));

      // Alert if biased
      if (result.status === 'CRITICAL_DRIFT' || result.overall_status === 'BIASED') {
        await tx.insert(notifications).values({
          orgId,
          title: 'CRITICAL ACCOUNTABILITY ALERT',
          message: `Automated analysis detected ${result.status || result.overall_status} for Audit ID: ${auditId.substring(0,8)}`,
          type: 'ALERT'
        });
      }
    });
}
