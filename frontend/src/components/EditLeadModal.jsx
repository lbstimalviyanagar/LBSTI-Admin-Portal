import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icons';
import {
  COURSES,
  BATCHES,
  SOURCES,
  OPEN_STATUSES,
  STATUSES,
  fmtDate,
  fmtDateTime,
  initials,
  avColor,
  slug,
  translateText
} from '../utils/helpers';
import api from '../services/api';

export default function EditLeadModal({
  lead,
  isOpen,
  counselorList = [],
  currentUser,
  onClose,
  onSave,
  onDelete,
  onConfirmAdmission,
  onToast
}) {
  const [formData, setFormData] = useState({});
  const [origSnapshot, setOrigSnapshot] = useState({});
  const [remarks, setRemarks] = useState([]);
  const [loadingRemarks, setLoadingRemarks] = useState(false);
  const [remarksError, setRemarksError] = useState('');
  const [newRemarkText, setNewRemarkText] = useState('');
  const [saving, setSaving] = useState(false);

  // Notes dictation & translation
  const [notesMicOn, setNotesMicOn] = useState(false);
  const [notesLang, setNotesLang] = useState('en-IN');
  const [notesState, setNotesState] = useState('');
  const [notesTranslating, setNotesTranslating] = useState(false);
  const [notesTranslation, setNotesTranslation] = useState(null);

  // Remark composer dictation & translation
  const [remarkMicOn, setRemarkMicOn] = useState(false);
  const [remarkLang, setRemarkLang] = useState('en-IN');
  const [remarkState, setRemarkState] = useState('');
  const [remarkTranslating, setRemarkTranslating] = useState(false);
  const [remarkTranslation, setRemarkTranslation] = useState(null);

  const notesRecRef = useRef(null);
  const remarkRecRef = useRef(null);
  const timelineRef = useRef(null);

  useEffect(() => {
    if (isOpen && lead) {
      const snap = {
        name: lead.name || '',
        phone: lead.phone || '',
        city: lead.city || '',
        course: lead.course || '',
        batch: lead.batch || '',
        source: lead.source || '',
        status: lead.status || 'New',
        assignedTo: lead.assignedTo || '',
        followUpDate: lead.followUpDate ? String(lead.followUpDate).slice(0, 10) : '',
        notes: lead.notes || ''
      };
      setFormData(snap);
      setOrigSnapshot(snap);
      setNewRemarkText('');
      setNotesTranslation(null);
      setRemarkTranslation(null);
      loadRemarks(lead.id);
    }
  }, [isOpen, lead]);

  const loadRemarks = async (leadId) => {
    setLoadingRemarks(true);
    setRemarksError('');
    try {
      const data = await api.getRemarks(leadId);
      setRemarks(data || []);
      setTimeout(() => {
        if (timelineRef.current) {
          timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
        }
      }, 50);
    } catch (err) {
      setRemarksError(err.message || "Couldn't load remarks history.");
    } finally {
      setLoadingRemarks(false);
    }
  };

  if (!isOpen || !lead) return null;

  // Check if form is modified
  const isDirty = Object.keys(formData).some(k => formData[k] !== (origSnapshot[k] || ''));

  // Notes Speech-to-text
  const toggleNotesVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotesState('Voice input requires Google Chrome or Microsoft Edge.');
      return;
    }

    if (notesMicOn) {
      notesRecRef.current?.stop();
      setNotesMicOn(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = notesLang;
      rec.interimResults = true;
      rec.continuous = true;

      const baseText = formData.notes && !/\s$/.test(formData.notes) ? formData.notes + " " : formData.notes;
      let fin = '';

      rec.onstart = () => {
        setNotesMicOn(true);
        setNotesState('Listening…');
      };
      rec.onresult = (ev) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const tr = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) fin += tr.trim() + " ";
          else interim += tr;
        }
        setFormData(prev => ({ ...prev, notes: baseText + fin + interim }));
      };
      rec.onerror = () => {
        setNotesState('Microphone stopped.');
        setNotesMicOn(false);
      };
      rec.onend = () => {
        setNotesMicOn(false);
        setNotesState('');
      };
      notesRecRef.current = rec;
      rec.start();
    } catch (e) {
      setNotesState('Could not start mic.');
      setNotesMicOn(false);
    }
  };

  // Remark Speech-to-text
  const toggleRemarkVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRemarkState('Voice input requires Google Chrome or Microsoft Edge.');
      return;
    }

    if (remarkMicOn) {
      remarkRecRef.current?.stop();
      setRemarkMicOn(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = remarkLang;
      rec.interimResults = true;
      rec.continuous = true;

      const baseText = newRemarkText && !/\s$/.test(newRemarkText) ? newRemarkText + " " : newRemarkText;
      let fin = '';

      rec.onstart = () => {
        setRemarkMicOn(true);
        setRemarkState('Listening…');
      };
      rec.onresult = (ev) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const tr = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) fin += tr.trim() + " ";
          else interim += tr;
        }
        setNewRemarkText(baseText + fin + interim);
      };
      rec.onerror = () => {
        setRemarkState('Microphone stopped.');
        setRemarkMicOn(false);
      };
      rec.onend = () => {
        setRemarkMicOn(false);
        setRemarkState('');
      };
      remarkRecRef.current = rec;
      rec.start();
    } catch (e) {
      setRemarkState('Could not start mic.');
      setRemarkMicOn(false);
    }
  };

  // Translate Notes
  const handleTranslateNotes = async () => {
    if (!formData.notes || !formData.notes.trim()) return;
    setNotesTranslating(true);
    try {
      const tr = await translateText(formData.notes, 'en');
      setNotesTranslation(tr);
    } catch (e) {
      onToast(e.message || "Translation error", true);
    } finally {
      setNotesTranslating(false);
    }
  };

  // Translate Remark
  const handleTranslateRemark = async () => {
    if (!newRemarkText.trim()) return;
    setRemarkTranslating(true);
    try {
      const tr = await translateText(newRemarkText, 'en');
      setRemarkTranslation(tr);
    } catch (e) {
      onToast(e.message || "Translation error", true);
    } finally {
      setRemarkTranslating(false);
    }
  };

  // Add new remark entry
  const handleAddRemark = async () => {
    const text = newRemarkText.trim();
    if (!text) return;

    if (remarkMicOn && remarkRecRef.current) {
      remarkRecRef.current.stop();
      setRemarkMicOn(false);
    }

    try {
      const author = currentUser?.name || 'Admin';
      const created = await api.addRemark(lead.id, text, author);
      setRemarks(prev => [...prev, created]);
      setNewRemarkText('');
      setRemarkTranslation(null);
      onToast("Remark added successfully.");
      setTimeout(() => {
        if (timelineRef.current) {
          timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
        }
      }, 50);
    } catch (err) {
      onToast(err.message || "Unable to add remark.", true);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      onToast("Student name cannot be empty.", true);
      return;
    }
    const cleanPhone = (formData.phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      onToast("Enter exactly 10 digits for the mobile number.", true);
      return;
    }

    const patch = {};
    for (const key of Object.keys(formData)) {
      if (formData[key] !== (origSnapshot[key] || '')) {
        patch[key] = formData[key];
      }
    }

    if (Object.keys(patch).length === 0) {
      onToast("No changes to save.");
      onClose();
      return;
    }

    setSaving(true);
    try {
      await onSave(lead.id, patch);
    } finally {
      setSaving(false);
    }
  };

  const isConfirmed = formData.status === "Confirmed";

  return (
    <div
      className="overlay"
      id="editOverlay"
      onMouseDown={(e) => {
        if (e.target.id === "editOverlay") onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mTitle"
      >
        {/* Header */}
        <header>
          <div className="t">
            <h3 id="mTitle">{formData.name || "Edit lead"}</h3>
            <small>Enquired on {fmtDate(lead.createdAt)}</small>
          </div>
          <span className={`pill s-${slug(formData.status)}`}>
            {formData.status}
          </span>
          <button
            className="icon-btn"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            <span className="ic"><Icon name="x" size={18} /></span>
          </button>
        </header>

        {/* Modal Body: Left column (details) + Right column (timeline & remarks) */}
        <div className="modal-body">
          <form className="edit-col" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
            {/* Student Info */}
            <div>
              <h4>Student information</h4>
              <div className="fgrid">
                <div className="fld">
                  <label htmlFor="e-name">Student Name <em>*</em></label>
                  <input
                    className="input"
                    id="e-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="fld">
                  <label htmlFor="e-phone">Contact Number <em>*</em></label>
                  <input
                    className="input"
                    id="e-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    inputMode="tel"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="fld full">
                  <label htmlFor="e-city">Locality/Area</label>
                  <input
                    className="input"
                    id="e-city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            {/* Enquiry Details */}
            <div>
              <h4>Enquiry details</h4>
              <div className="fgrid">
                <div className="fld">
                  <label htmlFor="e-course">Course <em>*</em></label>
                  <select
                    className="select"
                    id="e-course"
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  >
                    <option value="">Select Course</option>
                    {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="fld">
                  <label htmlFor="e-batch">Preferred batch</label>
                  <select
                    className="select"
                    id="e-batch"
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                  >
                    <option value="">Select Batch</option>
                    {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div className="fld">
                  <label htmlFor="e-source">Lead source</label>
                  <select
                    className="select"
                    id="e-source"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    <option value="">Select Source</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="fld">
                  <label htmlFor="e-assigned">Counselor</label>
                  <select
                    className="select"
                    id="e-assigned"
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  >
                    <option value="">Select Counselor</option>
                    {counselorList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="fld">
                  <label htmlFor="e-status">Status</label>
                  <select
                    className="select"
                    id="e-status"
                    value={formData.status}
                    disabled={isConfirmed}
                    title={isConfirmed ? "Use Confirm admission to manage confirmed status" : ""}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    {STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>

                <div className="fld">
                  <label htmlFor="e-follow">Next follow-up</label>
                  <input
                    className="input"
                    id="e-follow"
                    type="date"
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Remarks / Notes */}
            <div className="fld">
              <h4>Remarks & Notes</h4>
              <div className="notes-wrap">
                <textarea
                  className="textarea"
                  id="e-notes"
                  placeholder="Any additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
                <button
                  className={`mic-inline ${notesMicOn ? 'on' : ''}`}
                  type="button"
                  aria-label="Dictate notes"
                  onClick={toggleNotesVoice}
                  title="Speak notes into mic"
                >
                  <span className="ic"><Icon name="mic" size={17} /></span>
                </button>
              </div>

              <div className="notes-tools">
                <label className="sr-only" htmlFor="notesVoiceLang">Voice language</label>
                <select
                  className="select sm"
                  id="notesVoiceLang"
                  value={notesLang}
                  onChange={(e) => setNotesLang(e.target.value)}
                >
                  <option value="en-IN">English (India)</option>
                  <option value="hi-IN">हिन्दी (Hindi)</option>
                  <option value="en-US">English (US)</option>
                </select>

                <span className="voice-state">{notesState}</span>

                <button
                  className="btn link sm"
                  type="button"
                  onClick={handleTranslateNotes}
                  disabled={notesTranslating}
                >
                  <span className="ic"><Icon name="translate" size={15} /></span>
                  {notesTranslating ? 'Translating…' : 'Translate'}
                </button>
              </div>

              {notesTranslation && (
                <div className="translate-box">
                  <div className="tr-label">Translation (English)</div>
                  <p>{notesTranslation}</p>
                  <div className="tr-actions">
                    <button
                      className="btn sm"
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          notes: (prev.notes ? prev.notes.trim() + '\n\n' : '') + `Translation (EN): ${notesTranslation}`
                        }));
                        setNotesTranslation(null);
                      }}
                    >
                      Insert below
                    </button>
                    <button
                      className="btn sm"
                      type="button"
                      onClick={() => setNotesTranslation(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-foot" style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
              <button className="btn" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn primary"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>

          {/* Right Column: Admission Confirmation + Remarks History Timeline */}
          <aside className="side-col" aria-label="Admission and remarks">
            {/* Admission Action Card */}
            {isConfirmed ? (
              <div className="admit done">
                <span className="ai"><Icon name="shieldCheck" size={20} /></span>
                <div className="tx">
                  <b>Admission confirmed</b>
                  <span>This lead has been enrolled / confirmed.</span>
                </div>
              </div>
            ) : (
              <div className="admit">
                <span className="ai"><Icon name="shieldCheck" size={20} /></span>
                <div className="tx">
                  <b>Admission confirmation</b>
                  <span>Confirm once the parent has agreed.</span>
                </div>
                <button
                  className="btn success sm"
                  type="button"
                  onClick={() => onConfirmAdmission(lead.id)}
                >
                  Confirm admission
                </button>
              </div>
            )}

            {/* Remarks History Header */}
            <div className="rem-head">
              <h4>Remarks & activity</h4>
              <span className="muted">
                {remarks.length} {remarks.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {/* Timeline */}
            <div className="timeline" ref={timelineRef} aria-live="polite">
              {loadingRemarks ? (
                <>
                  <div className="skel" style={{ height: '52px', margin: '10px 0' }} />
                  <div className="skel" style={{ height: '52px', margin: '10px 0' }} />
                </>
              ) : remarksError ? (
                <div className="empty">
                  <div className="ei"><Icon name="alert" size={20} /></div>
                  <b>Couldn't load remarks</b>
                  <span>{remarksError}</span>
                  <br />
                  <button className="btn sm" type="button" onClick={() => loadRemarks(lead.id)}>
                    Try again
                  </button>
                </div>
              ) : remarks.length === 0 ? (
                <div className="empty">
                  <div className="ei"><Icon name="inbox" size={20} /></div>
                  <b>No remarks yet</b>
                  <span>Add the first note about this lead below.</span>
                </div>
              ) : (
                remarks.map((r, i) => {
                  const who = r.author || 'Admin';
                  return (
                    <div key={r.id || i} className="entry">
                      <span className="av" style={{ background: avColor(who) }}>
                        {initials(who)}
                      </span>
                      <div className="bubble">
                        <div className="who">
                          <b>{who}</b>
                          <span>{fmtDateTime(r.createdAt)}</span>
                        </div>
                        <p>{r.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Remark Composer */}
            <div className="composer">
              <div className="notes-wrap">
                <textarea
                  className="textarea"
                  placeholder="Add a remark, e.g. Student will visit tomorrow with parent to confirm admission."
                  value={newRemarkText}
                  onChange={(e) => setNewRemarkText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRemark();
                    }
                  }}
                />
                <button
                  className={`mic-inline ${remarkMicOn ? 'on' : ''}`}
                  type="button"
                  aria-label="Dictate remark"
                  onClick={toggleRemarkVoice}
                  title="Speak into mic"
                >
                  <span className="ic"><Icon name="mic" size={17} /></span>
                </button>
              </div>

              <div className="notes-tools">
                <label className="sr-only" htmlFor="voiceLang">Voice language</label>
                <select
                  className="select sm"
                  id="voiceLang"
                  value={remarkLang}
                  onChange={(e) => setRemarkLang(e.target.value)}
                >
                  <option value="en-IN">English (India)</option>
                  <option value="hi-IN">हिन्दी (Hindi)</option>
                  <option value="en-US">English (US)</option>
                </select>

                <span className="voice-state">{remarkState}</span>

                <button
                  className="btn link sm"
                  type="button"
                  onClick={handleTranslateRemark}
                  disabled={remarkTranslating}
                >
                  <span className="ic"><Icon name="translate" size={15} /></span>
                  {remarkTranslating ? 'Translating…' : 'Translate'}
                </button>
              </div>

              {remarkTranslation && (
                <div className="translate-box">
                  <div className="tr-label">Translation (English)</div>
                  <p>{remarkTranslation}</p>
                  <div className="tr-actions">
                    <button
                      className="btn sm"
                      type="button"
                      onClick={() => {
                        setNewRemarkText(prev => (prev ? prev.trim() + '\n\n' : '') + `Translation (EN): ${remarkTranslation}`);
                        setRemarkTranslation(null);
                      }}
                    >
                      Insert below
                    </button>
                    <button
                      className="btn sm"
                      type="button"
                      onClick={() => setRemarkTranslation(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              <div className="row">
                <small>Press Ctrl+Enter to add</small>
                <button
                  className="btn primary"
                  type="button"
                  disabled={!newRemarkText.trim()}
                  onClick={handleAddRemark}
                >
                  <span className="ic"><Icon name="send" size={16} /></span>
                  Add remark
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer>
          <button
            className="btn danger"
            type="button"
            aria-label="Delete lead"
            onClick={() => onDelete(lead.id)}
          >
            <span className="ic"><Icon name="trash" size={16} /></span>
            <span className="lbl">Delete lead</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
