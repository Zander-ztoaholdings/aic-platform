'use client'
import { Eyebrow } from '@/app/components/ui/Eyebrow';

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'

export default function CMSPage() {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isComposing, setIsComposing] = useState(false)
  const [newPost, setNewPost] = useState({ title: '', content: '', category: 'Legal', excerpt: '' })

  const fetchPosts = () => {
    fetch('/api/posts')
      .then(res => res.json())
      .then(data => {
        setPosts(data.posts || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleSavePost = async () => {
    if (!newPost.title || !newPost.content) return alert("Title and Content required.");

    try {
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newPost, status: 'DRAFT' })
        });

        if (response.ok) {
            alert("Draft saved to the archive.");
            setIsComposing(false);
            setNewPost({ title: '', content: '', category: 'Legal', excerpt: '' });
            fetchPosts();
        }
    } catch (err) {
        console.error(err);
    }
  }

  const handlePublish = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
        const response = await fetch('/api/posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus })
        });

        if (response.ok) {
            fetchPosts();
        }
    } catch (err) {
        console.error(err);
    }
  }

  return (
      <div className="max-w-6xl mx-auto space-y-12">
        <AnimatePresence mode="wait">
            {!isComposing ? (
                <motion.div 
                    key="list"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-12"
                >
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end">
                        <div>
                            <Eyebrow>HQ growth</Eyebrow>
                            <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Public Insights</h1>
                            <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">The "Voice of the Pioneer" content management.</p>
                        </div>
                        <button 
                            onClick={() => setIsComposing(true)}
                            className="bg-[#0e1b2c] text-white px-5 md:px-10 py-4 text-[12px] font-bold first-cap hover:bg-[#22344a] transition-all shadow-xl"
                        >
                            + COMPOSE NEW ARTICLE
                        </button>
                    </div>

                    <div className="bg-white border border-[#dde2e8] rounded-xl overflow-hidden">
                        <div className="p-4 sm:p-6 border-b border-[#dde2e8] bg-[#f5f7f9] flex justify-between items-center">
                            <span className="text-[12px] font-bold text-gray-500 first-cap">Active Archive</span>
                            <div className="flex gap-4">
                                <span className="text-[12px] text-green-700 first-cap">
                                    {posts.filter(p => p.status === 'PUBLISHED').length} Published
                                </span>
                                <span className="text-[12px] text-[#8a6a1f] first-cap">
                                    {posts.filter(p => p.status === 'DRAFT').length} Drafts
                                </span>
                            </div>
                        </div>
                        
                        <div className="divide-y divide-[#e6e9ee]">
                            {loading ? (
                                <div className="p-6 md:p-10 text-center text-sm text-[#5e6b7b]">Loading…</div>
                            ) : posts.length === 0 ? (
                                <div className="p-6 md:p-12 text-center text-gray-500">No posts found. Create your first insight.</div>
                            ) : posts.map((post, i) => (
                                <motion.div 
                                    key={post.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="p-5 md:p-8 hover:bg-[#eef1f5] transition-all group flex justify-between items-center"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-4">
                                            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                                                post.status === 'PUBLISHED' ? 'border-green-200 text-green-700 bg-green-50' : 'border-aic-gold/20 text-[#8a6a1f] bg-aic-gold/5'
                                            }`}>
                                                {post.status}
                                            </span>
                                            <span className="text-[12px] text-gray-500 first-cap">{post.category}</span>
                                        </div>
                                        <h3 className="text-xl font-serif text-[#0e1b2c] group-hover:text-[#8a6a1f] transition-colors">{post.title}</h3>
                                        <p className="text-[12px] text-gray-600 first-cap">Modified: {new Date(post.updated_at).toLocaleDateString()}</p>
                                    </div>
                                    
                                    <div className="flex gap-6">
                                        <button 
                                            onClick={() => handlePublish(post.id, post.status)}
                                            className={`text-[12px] font-bold first-cap transition-colors ${
                                                post.status === 'PUBLISHED' ? 'text-aic-red hover:text-[#0e1b2c]' : 'text-green-700 hover:text-[#0e1b2c]'
                                            }`}
                                        >
                                            {post.status === 'PUBLISHED' ? 'Unpublish' : 'Publish Now'}
                                        </button>
                                        <button className="text-[12px] font-bold first-cap text-gray-500 hover:text-[#0e1b2c] transition-colors">Edit</button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.div 
                    key="editor"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-12"
                >
                    {/* Editor Form */}
                    <div className="space-y-8 bg-white p-6 md:p-12 rounded-xl border border-[#dde2e8]">
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-4 sm:items-center mb-8">
                            <h2 className="text-2xl font-serif font-bold">New Insight</h2>
                            <button onClick={() => setIsComposing(false)} className="text-[12px] font-bold text-gray-500 hover:text-[#0e1b2c] first-cap">Discard</button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[12px] font-bold text-gray-500 first-cap mb-3">Article Title</label>
                                <input 
                                    className="w-full bg-transparent border-b border-[#dde2e8] py-3 text-2xl font-serif text-[#0e1b2c] focus:border-aic-gold outline-none transition-colors"
                                    placeholder="The Future of Human Oversight..."
                                    value={newPost.title}
                                    onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 md:gap-8">
                                <div>
                                    <label className="block text-[12px] font-bold text-gray-500 first-cap mb-3">Category</label>
                                    <select 
                                        className="w-full bg-transparent border-b border-[#dde2e8] py-2 font-mono text-xs focus:border-aic-gold outline-none"
                                        value={newPost.category}
                                        onChange={(e) => setNewPost({...newPost, category: e.target.value})}
                                    >
                                        <option>Legal</option>
                                        <option>Technical</option>
                                        <option>Consumer Rights</option>
                                        <option>Case Study</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12px] font-bold text-gray-500 first-cap mb-3">Content (Markdown)</label>
                                <textarea 
                                    className="w-full bg-white border border-[#dde2e8] rounded-2xl p-4 sm:p-6 font-mono text-xs text-[#0e1b2c] focus:border-aic-gold outline-none transition-all min-h-[400px]"
                                    placeholder="# Write your pioneer thoughts here..."
                                    value={newPost.content}
                                    onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleSavePost}
                            className="w-full bg-[#0e1b2c] text-white py-5 font-bold text-xs first-cap hover:bg-[#22344a] transition-all mt-8"
                        >
                            COMMIT TO DRAFT
                        </button>
                    </div>

                    {/* Live Preview */}
                    <div className="space-y-8 p-6 md:p-12">
                        <span className="text-[12px] font-bold text-[#8a6a1f] first-cap">Live Verification Preview</span>
                        <div className="prose prose-invert prose-aic font-serif">
                            <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">{newPost.title || 'Draft Title'}</h1>
                            <div className="opacity-80 leading-relaxed text-lg">
                                <ReactMarkdown>{newPost.content || '*Content preview will appear here as you type...*'}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <div className="p-6 md:p-12 border border-dashed border-[#dde2e8] rounded-xl text-center">
            <span className="text-2xl block mb-4">🛡️</span>
            <p className="text-gray-500 font-serif italic text-sm">
                Markdown Engine v2.0 <br />
                Direct publishing to AIC Public Registry active.
            </p>
        </div>
      </div>
  );
}
