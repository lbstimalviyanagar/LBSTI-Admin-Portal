import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import Icon from '../components/Icons';
import { fmtDay, fmtShort } from '../utils/helpers';

export default function CourseContentPage({ user, onToast }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [activeTab, setActiveTab] = useState('modules'); // 'modules' | 'syllabus' | 'notes' | 'overview'

  // Sub-data for selected course
  const [contentList, setContentList] = useState([]);
  const [syllabusList, setSyllabusList] = useState([]);
  const [notesList, setNotesList] = useState([]);
  const [subLoading, setSubLoading] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modals state
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseFormData, setCourseFormData] = useState({ id: null, name: '', code: '', category: 'General', duration: '3 Months', description: '', is_active: 1 });

  const [showModuleModal, setShowModuleModal] = useState(false);
  const [moduleFormData, setModuleFormData] = useState({ id: null, module_no: 1, title: '', topic: '', content: '', order_index: 1 });

  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  const [syllabusFormData, setSyllabusFormData] = useState({ id: null, title: 'Standard Syllabus', version: '1.0', document_url: '', description: '' });

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteFormData, setNoteFormData] = useState({ id: null, title: '', topic: '', content: '', attachment_url: '', file_type: 'pdf' });

  // Load all courses
  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCourses();
      const list = Array.isArray(data) ? data : (data?.data || []);
      setCourses(list);
      if (list.length > 0 && !selectedCourseId) {
        setSelectedCourseId(list[0].id);
      }
    } catch (err) {
      console.error(err);
      if (onToast) onToast('Failed to load courses', true);
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId, onToast]);

  useEffect(() => {
    loadCourses();
  }, []);

  // Load content for selected course
  const loadCourseData = useCallback(async (courseId) => {
    if (!courseId) return;
    setSubLoading(true);
    try {
      const [contents, syllabuses, notes] = await Promise.all([
        api.getCourseContent(courseId).catch(() => []),
        api.getCourseSyllabus(courseId).catch(() => []),
        api.getCourseNotes(courseId).catch(() => [])
      ]);
      setContentList(Array.isArray(contents) ? contents : (contents?.data || []));
      setSyllabusList(Array.isArray(syllabuses) ? syllabuses : (syllabuses?.data || []));
      setNotesList(Array.isArray(notes) ? notes : (notes?.data || []));
    } catch (err) {
      console.error(err);
      if (onToast) onToast('Failed to load course details', true);
    } finally {
      setSubLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseData(selectedCourseId);
    }
  }, [selectedCourseId, loadCourseData]);

  // Selected course object
  const selectedCourse = useMemo(() => {
    return courses.find(c => String(c.id) === String(selectedCourseId)) || null;
  }, [courses, selectedCourseId]);

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set();
    courses.forEach(c => {
      if (c.category) set.add(c.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [courses]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (c.name || '').toLowerCase();
        const code = (c.code || '').toLowerCase();
        const cat = (c.category || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    });
  }, [courses, categoryFilter, searchQuery]);

  // Handle Course Save
  const handleSaveCourse = async (e) => {
    e.preventDefault();
    if (!courseFormData.name.trim()) {
      if (onToast) onToast('Course name is required', true);
      return;
    }
    try {
      if (courseFormData.id) {
        await api.updateCourse(courseFormData.id, courseFormData);
        if (onToast) onToast('Course updated successfully');
      } else {
        const created = await api.createCourse(courseFormData);
        if (onToast) onToast('Course added successfully');
        if (created?.id) setSelectedCourseId(created.id);
      }
      setShowCourseModal(false);
      await loadCourses();
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to save course', true);
    }
  };

  // Handle Course Archive/Delete
  const handleDeleteCourse = async (id, name) => {
    if (!window.confirm(`Are you sure you want to archive "${name}"? Existing references will be preserved.`)) return;
    try {
      await api.deleteCourse(id);
      if (onToast) onToast(`Course "${name}" archived`);
      await loadCourses();
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to archive course', true);
    }
  };

  // Handle Module Save
  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!moduleFormData.title.trim()) {
      if (onToast) onToast('Module title is required', true);
      return;
    }
    try {
      const payload = {
        ...moduleFormData,
        course_id: selectedCourseId,
        order_index: Number(moduleFormData.order_index || 1),
        module_no: Number(moduleFormData.module_no || 1)
      };
      if (moduleFormData.id) {
        await api.updateCourseContent(moduleFormData.id, payload);
        if (onToast) onToast('Module updated');
      } else {
        await api.createCourseContent(payload);
        if (onToast) onToast('Module added');
      }
      setShowModuleModal(false);
      loadCourseData(selectedCourseId);
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to save module', true);
    }
  };

  const handleDeleteModule = async (id, title) => {
    if (!window.confirm(`Delete module "${title}"?`)) return;
    try {
      await api.deleteCourseContent(id);
      if (onToast) onToast('Module deleted');
      loadCourseData(selectedCourseId);
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to delete module', true);
    }
  };

  // Handle Syllabus Save
  const handleSaveSyllabus = async (e) => {
    e.preventDefault();
    if (!syllabusFormData.title.trim()) {
      if (onToast) onToast('Syllabus title is required', true);
      return;
    }
    try {
      const payload = {
        ...syllabusFormData,
        course_id: selectedCourseId
      };
      if (syllabusFormData.id) {
        await api.updateCourseSyllabus(syllabusFormData.id, payload);
        if (onToast) onToast('Syllabus updated');
      } else {
        await api.createCourseSyllabus(payload);
        if (onToast) onToast('Syllabus added');
      }
      setShowSyllabusModal(false);
      loadCourseData(selectedCourseId);
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to save syllabus', true);
    }
  };

  const handleDeleteSyllabus = async (id, title) => {
    if (!window.confirm(`Delete syllabus "${title}"?`)) return;
    try {
      await api.deleteCourseSyllabus(id);
      if (onToast) onToast('Syllabus deleted');
      loadCourseData(selectedCourseId);
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to delete syllabus', true);
    }
  };

  // Handle Note Save
  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteFormData.title.trim()) {
      if (onToast) onToast('Note title is required', true);
      return;
    }
    try {
      const payload = {
        ...noteFormData,
        course_id: selectedCourseId
      };
      if (noteFormData.id) {
        await api.updateCourseNotes(noteFormData.id, payload);
        if (onToast) onToast('Note updated');
      } else {
        await api.createCourseNotes(payload);
        if (onToast) onToast('Note added');
      }
      setShowNoteModal(false);
      loadCourseData(selectedCourseId);
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to save note', true);
    }
  };

  const handleDeleteNote = async (id, title) => {
    if (!window.confirm(`Delete note "${title}"?`)) return;
    try {
      await api.deleteCourseNotes(id);
      if (onToast) onToast('Note deleted');
      loadCourseData(selectedCourseId);
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to delete note', true);
    }
  };

  return (
    <div className="course-content-page" style={{ paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div className="page-head" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2>Course Content & Syllabus</h2>
          <p>Manage courses, syllabus documents, curriculum modules, and study notes.</p>
        </div>
        <div className="controls">
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              setCourseFormData({ id: null, name: '', code: '', category: 'IT & Software', duration: '3 Months', description: '', is_active: 1 });
              setShowCourseModal(true);
            }}
          >
            <span className="ic"><Icon name="plus" size={16} /></span>
            Add New Course
          </button>
          <button
            className="btn"
            type="button"
            onClick={loadCourses}
            title="Refresh course catalog"
          >
            <span className={`ic ${loading ? 'spin' : ''}`}><Icon name="refresh" size={16} /></span>
            Refresh
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Course Directory */}
        <div className="card section" style={{ margin: 0, padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Course Directory</h3>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{filteredCourses.length} courses</span>
          </div>

          {/* Search & Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              className="input"
              placeholder="Search course name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', fontSize: '0.875rem' }}
            />
            {categories.length > 2 && (
              <select
                className="select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem' }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat} Courses</option>
                ))}
              </select>
            )}
          </div>

          {/* Course List Scrollable */}
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '0.25rem' }}>
            {loading ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                <span>Loading courses...</span>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <p>No courses found matching filter.</p>
              </div>
            ) : (
              filteredCourses.map(c => {
                const isSelected = String(c.id) === String(selectedCourseId);
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCourseId(c.id)}
                    style={{
                      padding: '0.75rem 0.85rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ fontSize: '0.92rem', color: isSelected ? '#1d4ed8' : '#0f172a' }}>{c.name}</b>
                      {c.code && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px', color: '#475569' }}>
                          {c.code}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                      <span>{c.duration || 'Duration flexible'}</span>
                      <span style={{ textTransform: 'capitalize' }}>{c.category || 'General'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Course Detail, Modules, Syllabus, Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Header Card for Selected Course */}
          {selectedCourse ? (
            <div className="card section" style={{ margin: 0, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>{selectedCourse.name}</h2>
                    {selectedCourse.code && (
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '3px 8px', background: '#e0e7ff', color: '#4338ca', borderRadius: '6px' }}>
                        {selectedCourse.code}
                      </span>
                    )}
                    <span style={{ fontSize: '0.8rem', padding: '3px 8px', background: '#ecfdf5', color: '#047857', borderRadius: '6px' }}>
                      {selectedCourse.category || 'Standard'}
                    </span>
                  </div>
                  <p style={{ margin: '0.4rem 0 0', color: '#475569', fontSize: '0.9rem' }}>
                    {selectedCourse.description || 'No specific course description provided.'}
                  </p>
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                    <span>⏱ <b>Duration:</b> {selectedCourse.duration || 'Flexible'}</span>
                    <span>📚 <b>Modules:</b> {contentList.length}</span>
                    <span>📑 <b>Syllabus docs:</b> {syllabusList.length}</span>
                    <span>📝 <b>Study notes:</b> {notesList.length}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn"
                    type="button"
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                    onClick={() => {
                      setCourseFormData({ ...selectedCourse });
                      setShowCourseModal(true);
                    }}
                  >
                    <span className="ic"><Icon name="edit" size={14} /></span>
                    Edit Course
                  </button>
                  <button
                    className="btn"
                    type="button"
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', color: '#b91c1c' }}
                    onClick={() => handleDeleteCourse(selectedCourse.id, selectedCourse.name)}
                    title="Archive this course"
                  >
                    <span className="ic"><Icon name="trash" size={14} /></span>
                    Archive
                  </button>
                </div>
              </div>

              {/* Course Detail Tabs */}
              <div className="tabs" role="tablist" style={{ marginTop: '1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                <button
                  className="tab"
                  role="tab"
                  aria-selected={activeTab === 'modules'}
                  onClick={() => setActiveTab('modules')}
                >
                  <span className="ic"><Icon name="clipboard" size={16} /></span>
                  Modules & Topics ({contentList.length})
                </button>
                <button
                  className="tab"
                  role="tab"
                  aria-selected={activeTab === 'syllabus'}
                  onClick={() => setActiveTab('syllabus')}
                >
                  <span className="ic"><Icon name="book" size={16} /></span>
                  Syllabus Documents ({syllabusList.length})
                </button>
                <button
                  className="tab"
                  role="tab"
                  aria-selected={activeTab === 'notes'}
                  onClick={() => setActiveTab('notes')}
                >
                  <span className="ic"><Icon name="check" size={16} /></span>
                  Study Notes & Materials ({notesList.length})
                </button>
              </div>
            </div>
          ) : (
            <div className="card section" style={{ margin: 0, padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <span className="ic" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}><Icon name="book" size={32} /></span>
              <p>Select a course from the directory on the left or add a new course.</p>
            </div>
          )}

          {/* Tab 1: Modules & Topics */}
          {selectedCourse && activeTab === 'modules' && (
            <div className="card section" style={{ margin: 0, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Curriculum Modules & Topics</h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Breakdown of learning units, practical topics, and skill milestones.
                  </p>
                </div>
                <button
                  className="btn primary"
                  type="button"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  onClick={() => {
                    const nextNo = (contentList.length || 0) + 1;
                    setModuleFormData({ id: null, module_no: nextNo, title: '', topic: '', content: '', order_index: nextNo });
                    setShowModuleModal(true);
                  }}
                >
                  <span className="ic"><Icon name="plus" size={14} /></span>
                  Add Module
                </button>
              </div>

              {subLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                  <span>Loading curriculum...</span>
                </div>
              ) : contentList.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', border: '1.5px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
                  <p style={{ margin: '0 0 0.75rem' }}>No modules defined yet for {selectedCourse.name}.</p>
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => {
                      setModuleFormData({ id: null, module_no: 1, title: 'Module 1: Fundamentals', topic: 'Core Concepts', content: '', order_index: 1 });
                      setShowModuleModal(true);
                    }}
                  >
                    + Add First Module
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {contentList.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      style={{
                        padding: '1rem 1.15rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#2563eb',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            fontWeight: 700
                          }}>
                            {m.module_no || (idx + 1)}
                          </span>
                          <b style={{ fontSize: '1rem', color: '#0f172a' }}>{m.title}</b>
                          {m.topic && (
                            <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: '#e2e8f0', borderRadius: '4px', color: '#334155' }}>
                              {m.topic}
                            </span>
                          )}
                        </div>
                        {m.content && (
                          <div style={{ fontSize: '0.88rem', color: '#334155', whiteSpace: 'pre-wrap', marginTop: '0.4rem', lineHeight: '1.45' }}>
                            {m.content}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn"
                          type="button"
                          style={{ padding: '0.3rem 0.55rem', fontSize: '0.8rem' }}
                          onClick={() => {
                            setModuleFormData({ ...m });
                            setShowModuleModal(true);
                          }}
                          title="Edit module"
                        >
                          <span className="ic"><Icon name="edit" size={13} /></span>
                        </button>
                        <button
                          className="btn"
                          type="button"
                          style={{ padding: '0.3rem 0.55rem', fontSize: '0.8rem', color: '#b91c1c' }}
                          onClick={() => handleDeleteModule(m.id, m.title)}
                          title="Delete module"
                        >
                          <span className="ic"><Icon name="trash" size={13} /></span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Syllabus Documents */}
          {selectedCourse && activeTab === 'syllabus' && (
            <div className="card section" style={{ margin: 0, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Syllabus Documents</h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Official course outline, PDF handouts, and revision versions.
                  </p>
                </div>
                <button
                  className="btn primary"
                  type="button"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  onClick={() => {
                    setSyllabusFormData({ id: null, title: `${selectedCourse.name} Full Syllabus`, version: 'v2026.1', document_url: '', description: '' });
                    setShowSyllabusModal(true);
                  }}
                >
                  <span className="ic"><Icon name="plus" size={14} /></span>
                  Attach Syllabus
                </button>
              </div>

              {subLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                  <span>Loading syllabus documents...</span>
                </div>
              ) : syllabusList.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', border: '1.5px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
                  <p style={{ margin: '0 0 0.75rem' }}>No syllabus documents attached yet for {selectedCourse.name}.</p>
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => {
                      setSyllabusFormData({ id: null, title: `${selectedCourse.name} Syllabus`, version: '1.0', document_url: '', description: '' });
                      setShowSyllabusModal(true);
                    }}
                  >
                    + Add Syllabus Document
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {syllabusList.map((syl) => (
                    <div
                      key={syl.id}
                      style={{
                        padding: '1.1rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <b style={{ fontSize: '1rem', color: '#0f172a' }}>{syl.title}</b>
                          {syl.version && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 6px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px' }}>
                              {syl.version}
                            </span>
                          )}
                        </div>
                        {syl.description && (
                          <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#475569', lineHeight: '1.4' }}>
                            {syl.description}
                          </p>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.6rem' }}>
                          Updated: {fmtDay(syl.updated_at || syl.created_at || new Date())}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
                        {syl.document_url ? (
                          <a
                            href={syl.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn primary"
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
                          >
                            <span className="ic"><Icon name="download" size={13} /></span>
                            Download File
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Text only</span>
                        )}

                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            className="btn"
                            type="button"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              setSyllabusFormData({ ...syl });
                              setShowSyllabusModal(true);
                            }}
                            title="Edit syllabus"
                          >
                            <span className="ic"><Icon name="edit" size={13} /></span>
                          </button>
                          <button
                            className="btn"
                            type="button"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.8rem', color: '#b91c1c' }}
                            onClick={() => handleDeleteSyllabus(syl.id, syl.title)}
                            title="Delete syllabus"
                          >
                            <span className="ic"><Icon name="trash" size={13} /></span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Study Notes & Materials */}
          {selectedCourse && activeTab === 'notes' && (
            <div className="card section" style={{ margin: 0, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Study Notes & Learning Resources</h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Lecture notes, code examples, cheatsheets, and student reference guides.
                  </p>
                </div>
                <button
                  className="btn primary"
                  type="button"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  onClick={() => {
                    setNoteFormData({ id: null, title: '', topic: '', content: '', attachment_url: '', file_type: 'pdf' });
                    setShowNoteModal(true);
                  }}
                >
                  <span className="ic"><Icon name="plus" size={14} /></span>
                  Add Notes
                </button>
              </div>

              {subLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                  <span>Loading notes...</span>
                </div>
              ) : notesList.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', border: '1.5px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
                  <p style={{ margin: '0 0 0.75rem' }}>No notes or study materials uploaded yet for {selectedCourse.name}.</p>
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => {
                      setNoteFormData({ id: null, title: `${selectedCourse.name} Quick Notes`, topic: 'Overview', content: '', attachment_url: '', file_type: 'pdf' });
                      setShowNoteModal(true);
                    }}
                  >
                    + Create First Note
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {notesList.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        padding: '1.1rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <b style={{ fontSize: '1rem', color: '#0f172a' }}>{note.title}</b>
                            {note.topic && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', background: '#f1f5f9', borderRadius: '4px', color: '#475569' }}>
                                {note.topic}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                            Added: {fmtDay(note.created_at || new Date())}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {note.attachment_url && (
                            <a
                              href={note.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#2563eb' }}
                              title="Open attachment"
                            >
                              <span className="ic"><Icon name="download" size={13} /></span>
                              File
                            </a>
                          )}
                          <button
                            className="btn"
                            type="button"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              setNoteFormData({ ...note });
                              setShowNoteModal(true);
                            }}
                            title="Edit note"
                          >
                            <span className="ic"><Icon name="edit" size={13} /></span>
                          </button>
                          <button
                            className="btn"
                            type="button"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.8rem', color: '#b91c1c' }}
                            onClick={() => handleDeleteNote(note.id, note.title)}
                            title="Delete note"
                          >
                            <span className="ic"><Icon name="trash" size={13} /></span>
                          </button>
                        </div>
                      </div>

                      {note.content && (
                        <div style={{
                          padding: '0.75rem 0.9rem',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          fontSize: '0.88rem',
                          color: '#334155',
                          whiteSpace: 'pre-wrap',
                          lineHeight: '1.45',
                          border: '1px solid #f1f5f9'
                        }}>
                          {note.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add/Edit Course */}
      {showCourseModal && (
        <div className="modal-backdrop" onClick={() => setShowCourseModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-head">
              <h3>{courseFormData.id ? 'Edit Course' : 'Add New Course'}</h3>
              <button className="btn close-btn" onClick={() => setShowCourseModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveCourse}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                  <label className="label">Course Name *</label>
                  <input
                    type="text"
                    className="input"
                    required
                    value={courseFormData.name}
                    onChange={(e) => setCourseFormData({ ...courseFormData, name: e.target.value })}
                    placeholder="e.g. Python Full Stack, Advance Excel, Tally Prime"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label">Course Code</label>
                    <input
                      type="text"
                      className="input"
                      value={courseFormData.code || ''}
                      onChange={(e) => setCourseFormData({ ...courseFormData, code: e.target.value })}
                      placeholder="e.g. PY-101, TALLY"
                    />
                  </div>
                  <div>
                    <label className="label">Duration</label>
                    <input
                      type="text"
                      className="input"
                      value={courseFormData.duration || ''}
                      onChange={(e) => setCourseFormData({ ...courseFormData, duration: e.target.value })}
                      placeholder="e.g. 3 Months, 6 Weeks"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    className="select"
                    value={courseFormData.category || 'General'}
                    onChange={(e) => setCourseFormData({ ...courseFormData, category: e.target.value })}
                  >
                    <option value="IT & Software">IT & Software</option>
                    <option value="Accounting & Finance">Accounting & Finance</option>
                    <option value="Digital Media & Design">Digital Media & Design</option>
                    <option value="Office Productivity">Office Productivity</option>
                    <option value="Hardware & Networking">Hardware & Networking</option>
                    <option value="Language & Communication">Language & Communication</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="label">Overview / Description</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={courseFormData.description || ''}
                    onChange={(e) => setCourseFormData({ ...courseFormData, description: e.target.value })}
                    placeholder="Brief description of the course, target audience, and key skills taught."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowCourseModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Course</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Module */}
      {showModuleModal && (
        <div className="modal-backdrop" onClick={() => setShowModuleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-head">
              <h3>{moduleFormData.id ? 'Edit Curriculum Module' : 'Add Curriculum Module'}</h3>
              <button className="btn close-btn" onClick={() => setShowModuleModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveModule}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label">Module #</label>
                    <input
                      type="number"
                      className="input"
                      value={moduleFormData.module_no}
                      onChange={(e) => setModuleFormData({ ...moduleFormData, module_no: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Module Title *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={moduleFormData.title}
                      onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })}
                      placeholder="e.g. Introduction to Variables & Data Types"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Topic / Subject Area</label>
                  <input
                    type="text"
                    className="input"
                    value={moduleFormData.topic || ''}
                    onChange={(e) => setModuleFormData({ ...moduleFormData, topic: e.target.value })}
                    placeholder="e.g. Chapter 1, Syntax, Practical Lab"
                  />
                </div>
                <div>
                  <label className="label">Detailed Content & Learning Objectives</label>
                  <textarea
                    className="input"
                    rows={4}
                    value={moduleFormData.content || ''}
                    onChange={(e) => setModuleFormData({ ...moduleFormData, content: e.target.value })}
                    placeholder="List the specific topics, exercises, and outcomes for this module."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModuleModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Module</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Syllabus */}
      {showSyllabusModal && (
        <div className="modal-backdrop" onClick={() => setShowSyllabusModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-head">
              <h3>{syllabusFormData.id ? 'Edit Syllabus' : 'Attach Syllabus Document'}</h3>
              <button className="btn close-btn" onClick={() => setShowSyllabusModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveSyllabus}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                  <label className="label">Syllabus Title *</label>
                  <input
                    type="text"
                    className="input"
                    required
                    value={syllabusFormData.title}
                    onChange={(e) => setSyllabusFormData({ ...syllabusFormData, title: e.target.value })}
                    placeholder="e.g. Full Syllabus & Certification Guide"
                  />
                </div>
                <div>
                  <label className="label">Version / Year</label>
                  <input
                    type="text"
                    className="input"
                    value={syllabusFormData.version || ''}
                    onChange={(e) => setSyllabusFormData({ ...syllabusFormData, version: e.target.value })}
                    placeholder="e.g. v2026.1, Rev 2.0"
                  />
                </div>
                <div>
                  <label className="label">Document Link / URL</label>
                  <input
                    type="url"
                    className="input"
                    value={syllabusFormData.document_url || ''}
                    onChange={(e) => setSyllabusFormData({ ...syllabusFormData, document_url: e.target.value })}
                    placeholder="https://... or /uploads/syllabus.pdf"
                  />
                  <small style={{ color: '#64748b', fontSize: '0.78rem', display: 'block', marginTop: '0.25rem' }}>
                    Provide a direct link or upload path to the PDF / document file.
                  </small>
                </div>
                <div>
                  <label className="label">Description / Remarks</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={syllabusFormData.description || ''}
                    onChange={(e) => setSyllabusFormData({ ...syllabusFormData, description: e.target.value })}
                    placeholder="Brief description of what is covered in this syllabus edition."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowSyllabusModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Syllabus</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Notes */}
      {showNoteModal && (
        <div className="modal-backdrop" onClick={() => setShowNoteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-head">
              <h3>{noteFormData.id ? 'Edit Study Note' : 'Add Study Note'}</h3>
              <button className="btn close-btn" onClick={() => setShowNoteModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveNote}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                  <label className="label">Note Title *</label>
                  <input
                    type="text"
                    className="input"
                    required
                    value={noteFormData.title}
                    onChange={(e) => setNoteFormData({ ...noteFormData, title: e.target.value })}
                    placeholder="e.g. Formula Cheatsheet, Interview Q&A"
                  />
                </div>
                <div>
                  <label className="label">Topic / Unit</label>
                  <input
                    type="text"
                    className="input"
                    value={noteFormData.topic || ''}
                    onChange={(e) => setNoteFormData({ ...noteFormData, topic: e.target.value })}
                    placeholder="e.g. Chapter 4: VLOOKUP & XLOOKUP"
                  />
                </div>
                <div>
                  <label className="label">Note Content / Summary</label>
                  <textarea
                    className="input"
                    rows={4}
                    value={noteFormData.content || ''}
                    onChange={(e) => setNoteFormData({ ...noteFormData, content: e.target.value })}
                    placeholder="Write key takeaways, explanations, formulas, or instructions."
                  />
                </div>
                <div>
                  <label className="label">File / Reference URL (Optional)</label>
                  <input
                    type="url"
                    className="input"
                    value={noteFormData.attachment_url || ''}
                    onChange={(e) => setNoteFormData({ ...noteFormData, attachment_url: e.target.value })}
                    placeholder="https://... link to document, slide deck, or sheet"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowNoteModal(false)}>Cancel</button>
                <button type="submit" className="btn primary">Save Note</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
