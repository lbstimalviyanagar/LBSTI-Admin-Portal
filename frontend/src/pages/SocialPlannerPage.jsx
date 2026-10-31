import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import Icon from '../components/Icons';
import { fmtDay, fmtShort } from '../utils/helpers';

const PLATFORMS = [
  { id: 'Instagram', name: 'Instagram', color: '#e1306c', bg: '#fdf2f8' },
  { id: 'Facebook', name: 'Facebook', color: '#1877f2', bg: '#eff6ff' },
  { id: 'YouTube', name: 'YouTube', color: '#ff0000', bg: '#fef2f2' },
  { id: 'LinkedIn', name: 'LinkedIn', color: '#0a66c2', bg: '#f0f9ff' },
  { id: 'X', name: 'X / Twitter', color: '#0f172a', bg: '#f8fafc' },
  { id: 'Website', name: 'Website Blog', color: '#0d9488', bg: '#f0fdfa' }
];

const STATUS_CONFIG = {
  Draft: { color: '#64748b', bg: '#f1f5f9' },
  Scheduled: { color: '#2563eb', bg: '#eff6ff' },
  Published: { color: '#16a34a', bg: '#f0fdf4' },
  Archived: { color: '#94a3b8', bg: '#f8fafc' }
};

export default function SocialPlannerPage({ user, onToast }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [platformFilter, setPlatformFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    title: '',
    platform: 'Instagram',
    caption: '',
    hashtags: '#LBSTI #ComputerCourses #SkillDevelopment #Delhi',
    media_url: '',
    cta: 'Call / WhatsApp: 9990352721 to enroll today!',
    scheduled_at: '',
    status: 'Scheduled',
    notes: ''
  });

  // Load posts
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSocialPosts();
      const list = Array.isArray(data) ? data : (data?.data || []);
      setPosts(list);
    } catch (err) {
      console.error(err);
      if (onToast) onToast('Failed to load social posts', true);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Filtered posts
  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      if (platformFilter !== 'All' && p.platform !== platformFilter) return false;
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t = (p.title || '').toLowerCase();
        const c = (p.caption || '').toLowerCase();
        const h = (p.hashtags || '').toLowerCase();
        if (!t.includes(q) && !c.includes(q) && !h.includes(q)) return false;
      }
      return true;
    });
  }, [posts, platformFilter, statusFilter, searchQuery]);

  // Handle Save
  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.caption.trim()) {
      if (onToast) onToast('Title and caption are required', true);
      return;
    }
    try {
      if (formData.id) {
        await api.updateSocialPost(formData.id, formData);
        if (onToast) onToast('Post updated successfully');
      } else {
        await api.createSocialPost(formData);
        if (onToast) onToast('Post scheduled successfully');
      }
      setShowModal(false);
      await loadPosts();
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to save post', true);
    }
  };

  // Handle Delete
  const handleDeletePost = async (id, title) => {
    if (!window.confirm(`Delete post "${title}"?`)) return;
    try {
      await api.deleteSocialPost(id);
      if (onToast) onToast('Post deleted');
      await loadPosts();
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to delete post', true);
    }
  };

  // Quick Copy Caption + Hashtags to Clipboard
  const handleQuickCopy = (post) => {
    const fullText = `${post.caption || ''}\n\n${post.cta ? `${post.cta}\n\n` : ''}${post.hashtags || ''}`.trim();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText).then(() => {
        if (onToast) onToast('Post caption & hashtags copied to clipboard!');
      }).catch(() => {
        fallbackCopyText(fullText);
      });
    } else {
      fallbackCopyText(fullText);
    }
  };

  const fallbackCopyText = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      if (onToast) onToast('Copied to clipboard!');
    } catch (err) {
      if (onToast) onToast('Could not copy to clipboard', true);
    }
    document.body.removeChild(textArea);
  };

  // Quick Status Toggle
  const handleStatusToggle = async (post) => {
    const nextStatus = post.status === 'Draft' ? 'Scheduled' : post.status === 'Scheduled' ? 'Published' : 'Draft';
    try {
      await api.updateSocialPost(post.id, { ...post, status: nextStatus });
      setPosts(prev => prev.map(p => String(p.id) === String(post.id) ? { ...p, status: nextStatus } : p));
      if (onToast) onToast(`Post status updated to ${nextStatus}`);
    } catch (err) {
      if (onToast) onToast('Failed to update status', true);
    }
  };

  // Stat counters
  const stats = useMemo(() => {
    const scheduled = posts.filter(p => p.status === 'Scheduled').length;
    const published = posts.filter(p => p.status === 'Published').length;
    const drafts = posts.filter(p => p.status === 'Draft').length;
    return { total: posts.length, scheduled, published, drafts };
  }, [posts]);

  return (
    <div className="social-planner-page" style={{ paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div className="page-head" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2>Social Media Content Planner</h2>
          <p>Plan, organize, and copy marketing campaigns across Instagram, Facebook, YouTube, and LinkedIn.</p>
        </div>
        <div className="controls">
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              setFormData({
                id: null,
                title: '',
                platform: 'Instagram',
                caption: '',
                hashtags: '#LBSTI #ComputerCourses #SkillDevelopment #Delhi #MalviyaNagar',
                media_url: '',
                cta: 'Call / WhatsApp: 9990352721 to book your free demo class!',
                scheduled_at: new Date().toISOString().slice(0, 16),
                status: 'Scheduled',
                notes: ''
              });
              setShowModal(true);
            }}
          >
            <span className="ic"><Icon name="plus" size={16} /></span>
            New Post
          </button>
          <button
            className="btn"
            type="button"
            onClick={loadPosts}
            title="Refresh posts"
          >
            <span className={`ic ${loading ? 'spin' : ''}`}><Icon name="refresh" size={16} /></span>
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="stats" style={{ marginBottom: '1.25rem' }}>
        <div className="card stat">
          <div className="stat-top">
            <span className="stat-ico"><Icon name="calendar" size={20} /></span>
            <span className="stat-label">Total Posts</span>
          </div>
          <div className="stat-val">{stats.total}</div>
          <div className="stat-sub">Across all social platforms</div>
        </div>

        <div className="card stat">
          <div className="stat-top">
            <span className="stat-ico" style={{ color: '#2563eb' }}><Icon name="clock" size={20} /></span>
            <span className="stat-label">Scheduled</span>
          </div>
          <div className="stat-val" style={{ color: '#2563eb' }}>{stats.scheduled}</div>
          <div className="stat-sub">Ready for publication</div>
        </div>

        <div className="card stat">
          <div className="stat-top">
            <span className="stat-ico" style={{ color: '#16a34a' }}><Icon name="check" size={20} /></span>
            <span className="stat-label">Published</span>
          </div>
          <div className="stat-val" style={{ color: '#16a34a' }}>{stats.published}</div>
          <div className="stat-sub">Live on social channels</div>
        </div>

        <div className="card stat">
          <div className="stat-top">
            <span className="stat-ico" style={{ color: '#64748b' }}><Icon name="edit" size={20} /></span>
            <span className="stat-label">Drafts</span>
          </div>
          <div className="stat-val" style={{ color: '#64748b' }}>{stats.drafts}</div>
          <div className="stat-sub">Ideas in progress</div>
        </div>
      </div>

      {/* Filter and View Options */}
      <div className="card section" style={{ margin: '0 0 1.25rem 0', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
            <input
              type="text"
              className="input"
              placeholder="Search post title, caption, hashtags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: '240px', fontSize: '0.88rem' }}
            />

            <select
              className="select"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            >
              <option value="All">All Platforms</option>
              {PLATFORMS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            >
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              className={`btn ${viewMode === 'grid' ? 'primary' : ''}`}
              onClick={() => setViewMode('grid')}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
            >
              Cards Grid
            </button>
            <button
              type="button"
              className={`btn ${viewMode === 'table' ? 'primary' : ''}`}
              onClick={() => setViewMode('table')}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
            >
              Table View
            </button>
          </div>
        </div>
      </div>

      {/* Grid Mode */}
      {viewMode === 'grid' && (
        <div>
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
              <span>Loading social media content...</span>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="card section" style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
              <p>No posts match the selected filters.</p>
              <button
                className="btn primary"
                type="button"
                style={{ marginTop: '0.5rem' }}
                onClick={() => {
                  setPlatformFilter('All');
                  setStatusFilter('All');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {filteredPosts.map(post => {
                const plat = PLATFORMS.find(p => p.id === post.platform) || { name: post.platform, color: '#475569', bg: '#f1f5f9' };
                const st = STATUS_CONFIG[post.status] || STATUS_CONFIG.Draft;

                return (
                  <div
                    key={post.id}
                    className="card section"
                    style={{
                      margin: 0,
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: plat.color,
                          backgroundColor: plat.bg,
                          border: `1px solid ${plat.color}33`
                        }}>
                          {plat.name}
                        </span>

                        <span
                          onClick={() => handleStatusToggle(post)}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: st.color,
                            backgroundColor: st.bg,
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                          title="Click to toggle status"
                        >
                          ● {post.status}
                        </span>
                      </div>

                      {/* Post Title & Date */}
                      <b style={{ fontSize: '1.05rem', color: '#0f172a', display: 'block', marginBottom: '0.25rem', lineHeight: '1.3' }}>
                        {post.title}
                      </b>
                      {post.scheduled_at && (
                        <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.75rem' }}>
                          📅 {fmtDay(post.scheduled_at)}
                        </span>
                      )}

                      {/* Caption Preview */}
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '6px',
                        fontSize: '0.88rem',
                        color: '#334155',
                        lineHeight: '1.45',
                        whiteSpace: 'pre-wrap',
                        border: '1px solid #f1f5f9',
                        maxHeight: '140px',
                        overflowY: 'auto',
                        marginBottom: '0.65rem'
                      }}>
                        {post.caption}
                      </div>

                      {/* CTA */}
                      {post.cta && (
                        <div style={{ fontSize: '0.82rem', color: '#1d4ed8', fontWeight: 600, marginBottom: '0.5rem' }}>
                          🔗 {post.cta}
                        </div>
                      )}

                      {/* Hashtags */}
                      {post.hashtags && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', wordBreak: 'break-word', marginBottom: '0.75rem' }}>
                          {post.hashtags}
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9' }}>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => handleQuickCopy(post)}
                        style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
                        title="Copy caption and hashtags to clipboard"
                      >
                        <span className="ic"><Icon name="copy" size={14} /></span>
                        Copy Text
                      </button>

                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {post.media_url && (
                          <a
                            href={post.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.8rem', color: '#2563eb' }}
                            title="Open media/creative link"
                          >
                            <span className="ic"><Icon name="download" size={13} /></span>
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '0.3rem 0.55rem', fontSize: '0.8rem' }}
                          onClick={() => {
                            setFormData({ ...post });
                            setShowModal(true);
                          }}
                          title="Edit post"
                        >
                          <span className="ic"><Icon name="edit" size={13} /></span>
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '0.3rem 0.55rem', fontSize: '0.8rem', color: '#b91c1c' }}
                          onClick={() => handleDeletePost(post.id, post.title)}
                          title="Delete post"
                        >
                          <span className="ic"><Icon name="trash" size={13} /></span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Table Mode */}
      {viewMode === 'table' && (
        <div className="card section" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem', color: '#475569' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Platform</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Title & Content</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Scheduled Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post, idx) => {
                  const plat = PLATFORMS.find(p => p.id === post.platform) || { name: post.platform, color: '#475569', bg: '#f1f5f9' };
                  const st = STATUS_CONFIG[post.status] || STATUS_CONFIG.Draft;

                  return (
                    <tr key={post.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: plat.color,
                          backgroundColor: plat.bg
                        }}>
                          {plat.name}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <b style={{ color: '#0f172a', display: 'block' }}>{post.title}</b>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {post.caption}
                        </p>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#475569' }}>
                        {post.scheduled_at ? fmtDay(post.scheduled_at) : '–'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: st.color,
                          backgroundColor: st.bg
                        }}>
                          {post.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn primary"
                            onClick={() => handleQuickCopy(post)}
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                            title="Copy text"
                          >
                            <span className="ic"><Icon name="copy" size={13} /></span>
                            Copy
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem' }}
                            onClick={() => {
                              setFormData({ ...post });
                              setShowModal(true);
                            }}
                          >
                            <span className="ic"><Icon name="edit" size={13} /></span>
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem', color: '#b91c1c' }}
                            onClick={() => handleDeletePost(post.id, post.title)}
                          >
                            <span className="ic"><Icon name="trash" size={13} /></span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Post */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-head">
              <h3>{formData.id ? 'Edit Social Post' : 'Schedule New Social Post'}</h3>
              <button className="btn close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSavePost}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label className="label">Campaign / Post Title *</label>
                  <input
                    type="text"
                    className="input"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Admissions Open for Advanced Excel & Tally"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label">Platform *</label>
                    <select
                      className="select"
                      value={formData.platform}
                      onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    >
                      {PLATFORMS.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select
                      className="select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Published">Published</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={formData.scheduled_at ? formData.scheduled_at.slice(0, 16) : ''}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Caption / Post Copy *</label>
                  <textarea
                    className="input"
                    rows={4}
                    required
                    value={formData.caption}
                    onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                    placeholder="Write the full social media caption, promotional text, course highlights..."
                  />
                </div>

                <div>
                  <label className="label">Call to Action (CTA)</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.cta || ''}
                    onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                    placeholder="e.g. Call / WhatsApp 9990352721 to reserve your seat!"
                  />
                </div>

                <div>
                  <label className="label">Hashtags</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.hashtags || ''}
                    onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                    placeholder="#LBSTI #ComputerCourses #SkillDevelopment"
                  />
                </div>

                <div>
                  <label className="label">Creative / Media Link (Optional)</label>
                  <input
                    type="url"
                    className="input"
                    value={formData.media_url || ''}
                    onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                    placeholder="Link to Canva graphic, Google Drive, image URL"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Post</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

