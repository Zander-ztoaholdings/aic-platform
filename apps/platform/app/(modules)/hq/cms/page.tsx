'use client'

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
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-4xl font-serif font-medium tracking-tight">Public Insights</h1>
                            <p className="text-gray-500 font-serif mt-2 italic text-lg text-aic-gold">The "Voice of the Pioneer" content management.</p>
                        </div>
                        <button 
                            onClick={() => setIsComposing(true)}
                            className="bg-aic-paper text-black px-10 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-aic-gold transition-all shadow-xl"
                        >
                            + COMPOSE NEW ARTICLE
                        </button>
                    </div>

                    <div className="bg-black/40 border border-aic-paper/5 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-aic-paper/5 bg-aic-paper/5 flex justify-between items-center">
                            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Active Archive</span>
                            <div className="flex gap-4">
                                <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest">
                                    {posts.filter(p => p.status === 'PUBLISHED').length} Published
                                </span>
                                <span className="text-[10px] font-mono text-aic-gold uppercase tracking-widest">
                                    {posts.filter(p => p.status === 'DRAFT').length} Drafts
                                </span>
                            </div>
                        </div>
                        
                        <div className="divide-y divide-aic-paper/5">
                            {loading ? (
                                <div className="p-12 text-center text-gray-500 font-serif italic">Syncing with content core...</div>
                            ) : posts.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">No posts found. Create your first insight.</div>
                            ) : posts.map((post, i) => (
                                <motion.div 
                                    key={post.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="p-8 hover:bg-aic-paper/5 transition-all group flex justify-between items-center"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-4">
                                            <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded border ${
                                                post.status === 'PUBLISHED' ? 'border-green-500/20 text-green-400 bg-green-500/5' : 'border-aic-gold/20 text-aic-gold bg-aic-gold/5'
                                            }`}>
                                                {post.status}
                                            </span>
                                            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{post.category}</span>
                                        </div>
                                        <h3 className="text-xl font-serif text-aic-paper group-hover:text-aic-gold transition-colors">{post.title}</h3>
                                        <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Modified: {new Date(post.updated_at).toLocaleDateString()}</p>
                                    </div>
                                    
                                    <div className="flex gap-6">
                                        <button 
                                            onClick={() => handlePublish(post.id, post.status)}
                                            className={`text-[10px] font-mono font-bold uppercase tracking-widest transition-colors ${
                                                post.status === 'PUBLISHED' ? 'text-aic-red hover:text-aic-paper' : 'text-green-400 hover:text-aic-paper'
                                            }`}
                                        >
                                            {post.status === 'PUBLISHED' ? 'Unpublish' : 'Publish Now'}
                                        </button>
                                        <button className="text-[10px] font-mono font-bold uppercase text-gray-500 hover:text-aic-paper transition-colors tracking-widest">Edit</button>
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
                    className="grid grid-cols-1 lg:grid-cols-2 gap-12"
                >
                    {/* Editor Form */}
                    <div className="space-y-8 bg-[#141414] p-12 rounded-[3rem] border border-aic-paper/5">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-serif font-bold">New Insight</h2>
                            <button onClick={() => setIsComposing(false)} className="text-[10px] font-mono font-bold text-gray-500 hover:text-aic-paper uppercase tracking-widest">Discard</button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-3">Article Title</label>
                                <input 
                                    className="w-full bg-transparent border-b border-aic-paper/10 py-3 text-2xl font-serif text-aic-paper focus:border-aic-gold outline-none transition-colors"
                                    placeholder="The Future of Human Oversight..."
                                    value={newPost.title}
                                    onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-3">Category</label>
                                    <select 
                                        className="w-full bg-transparent border-b border-aic-paper/10 py-2 font-mono text-xs focus:border-aic-gold outline-none"
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
                                <label className="block text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-3">Content (Markdown)</label>
                                <textarea 
                                    className="w-full bg-black/40 border border-aic-paper/10 rounded-2xl p-6 font-mono text-xs text-aic-paper focus:border-aic-gold outline-none transition-all min-h-[400px]"
                                    placeholder="# Write your pioneer thoughts here..."
                                    value={newPost.content}
                                    onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleSavePost}
                            className="w-full bg-aic-paper text-black py-5 font-mono font-bold text-xs uppercase tracking-[0.3em] hover:bg-aic-gold transition-all mt-8"
                        >
                            COMMIT TO DRAFT
                        </button>
                    </div>

                    {/* Live Preview */}
                    <div className="space-y-8 p-12">
                        <span className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em]">Live Verification Preview</span>
                        <div className="prose prose-invert prose-aic font-serif">
                            <h1 className="text-5xl font-medium tracking-tight mb-8">{newPost.title || 'Draft Title'}</h1>
                            <div className="opacity-80 leading-relaxed text-lg">
                                <ReactMarkdown>{newPost.content || '*Content preview will appear here as you type...*'}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <div className="p-12 border border-dashed border-aic-paper/10 rounded-3xl text-center">
            <span className="text-2xl block mb-4">🛡️</span>
            <p className="text-gray-500 font-serif italic text-sm">
                Markdown Engine v2.0 <br />
                Direct publishing to AIC Public Registry active.
            </p>
        </div>
      </div>
  );
}
