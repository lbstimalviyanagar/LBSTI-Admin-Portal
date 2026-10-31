import React, { useState, useEffect, useRef, useMemo } from 'react';
import Icon from './Icons';
import {
  COURSES,
  BATCHES,
  STANDARDIZED_SOURCES,
  normalizeLeadSource,
  canonicalCounselorName,
  STATUSES,
  COUNSELORS,
  isoDay,
  translateText,
  getSuggestedFollowUpDate
} from '../utils/helpers';
import api from '../services/api';

export default function NewEnquiryForm({
  counselorList = COUNSELORS,
  onSubmit,
  onCancel,
  onOpenEditLead
}) {
  const [formData, setFormData] = useState({
    date: isoDay(new Date()),
    name: '',
    phone: '',
    city: '',
    course: '',
    batch: '',
    source: '',
    assignedTo: '',
    status: 'New Enquiry',
    followUpDate: getSuggestedFollowUpDate(),
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [coursesList, setCoursesList] = useState(COURSES);

  // Duplicate contact detection state (Phase 2.2)
  const [duplicateContact, setDuplicateContact] = useState(null);
  const [allowRepeatContact, setAllowRepeatContact] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);

  // Fetch dynamic courses list from backend
  useEffect(() => {
    api.getCourses()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.map(c => c.name).filter(Boolean);
          const merged = Array.from(new Set([...names, ...COURSES])).sort();
          setCoursesList(merged);
        }
      })
      .catch(() => {});
  }, []);

  // Apply a Set to ensure only unique counselor names are mapped to the <option> elements
  const uniqueCounselorList = useMemo(() => {
    const seen = new Set();
    const result = [];

    (counselorList || []).forEach((c) => {
      const raw = typeof c === 'string' ? c : (c?.fullName || c?.name || '');
      const canonical = canonicalCounselorName(raw);
      if (canonical && !seen.has(canonical.toLowerCase())) {
        seen.add(canonical.toLowerCase());
        result.push(canonical);
      }
    });

    return result.sort((a, b) => a.localeCompare(b));
  }, [counselorList]);

  // Voice dictation state
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('en-IN');
  const [voiceState, setVoiceState] = useState('');
  const recognitionRef = useRef(null);

  // Translation state
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState(null);
  const [translationError, setTranslationError] = useState('');

  const nameInputRef = useRef(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Check phone for existing contact on blur or completion
  const handlePhoneBlur = async () => {
    const clean = formData.phone.replace(/\D/g, '');
    if (clean.length < 10) return;
    setCheckingPhone(true);
    try {
      const res = await api.checkPhone(clean);
      if (res && res.exists && res.enquiry) {
        setDuplicateContact(res.enquiry);
      } else {
        setDuplicateContact(null);
      }
    } catch (e) {
    } finally {
      setCheckingPhone(false);
    }
  };

  // Voice speech-to-text setup
  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceState('Voice input requires Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = voiceLang;
      rec.interimResults = true;
      rec.continuous = true;

      const baseText = formData.notes && !/\s$/.test(formData.notes) ? formData.notes + " " : formData.notes;
      let finalText = '';

      rec.onstart = () => {
        setIsListening(true);
        setVoiceState('Listening… Speak now');
      };

      rec.onresult = (ev) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalText += t.trim() + " ";
          else interim += t;
        }
        setFormData(prev => ({
          ...prev,
          notes: baseText + finalText + interim
        }));
      };

      rec.onerror = () => {
        setVoiceState('Microphone stopped.');
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        setVoiceState('');
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      setVoiceState('Could not start microphone.');
      setIsListening(false);
    }
  };

  // Translation handler
  const handleTranslate = async () => {
    if (!formData.notes || !formData.notes.trim()) {
      setTranslationError('Please enter or dictate remarks first.');
      return;
    }

    setTranslating(true);
    setTranslationError('');
    setTranslation(null);

    try {
      const result = await translateText(formData.notes, 'en');
      setTranslation(result);
    } catch (err) {
      setTranslationError(err.message || 'Translation failed.');
    } finally {
      setTranslating(false);
    }
  };

  const handleInsertTranslation = () => {
    if (!translation) return;
    setFormData(prev => ({
      ...prev,
      notes: (prev.notes ? prev.notes.trim() + '\n\n' : '') + `Translation (EN): ${translation}`
    }));
    setTranslation(null);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errs.name = "Enter the student's name.";
    }
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      errs.phone = "Enter exactly 10 digits for the mobile number.";
    }
    if (!formData.course) {
      errs.course = "Choose a course.";
    }
    if (!formData.date) {
      errs.date = "Please select an inquiry date.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setSubmitting(true);
    try {
      await onSubmit({
        date: formData.date,
        inquiryDate: formData.date,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        city: formData.city.trim(),
        course: formData.course,
        batch: formData.batch,
        source: normalizeLeadSource(formData.source),
        assignedTo: canonicalCounselorName(formData.assignedTo),
        status: formData.status || 'New Enquiry',
        followUpDate: formData.followUpDate || '',
        notes: formData.notes.trim(),
        allowRepeatContact: allowRepeatContact || !!duplicateContact
      });
    } catch (err) {
      if (err.data && err.data.conflict && err.data.existing) {
        setDuplicateContact(err.data.existing);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setFormData({
      date: isoDay(new Date()),
      name: '',
      phone: '',
      city: '',
      course: '',
      batch: '',
      source: '',
      assignedTo: '',
      status: 'New Enquiry',
      followUpDate: getSuggestedFollowUpDate(),
      notes: ''
    });
    setDuplicateContact(null);
    setAllowRepeatContact(false);
    setErrors({});
    setTranslation(null);
    setTranslationError('');
    setVoiceState('');
  };

  return (
    <section>
      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        <div className="form-body">
          <h3>Add New Lead</h3>

          {/* Duplicate Contact Detection Banner (Phase 2.2) */}
          {duplicateContact && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '14px 16px',
              marginBottom: '18px',
              color: '#92400e'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <b style={{ fontSize: '0.95rem' }}>⚠️ Existing Contact Detected</b>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                    A lead already exists for <b>{duplicateContact.name}</b> (Lead #{duplicateContact.id} · Course: {duplicateContact.course || 'None'} · Status: {duplicateContact.status}).
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {onOpenEditLead && (
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => onOpenEditLead(duplicateContact.id)}
                    >
                      View Existing Record
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn sm ok"
                    onClick={() => setAllowRepeatContact(true)}
                  >
                    {allowRepeatContact ? '✓ Additional Inquiry Enabled' : 'Allow Additional Inquiry'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="fgrid new-lead-grid">
            {/* Inquiry Date (Editable, Phase 2.1) */}
            <div className={`fld ${errors.date ? 'bad' : ''}`}>
              <label htmlFor="f-date">Inquiry Date <em>*</em></label>
              <input
                className="input"
                id="f-date"
                type="date"
                value={formData.date}
                onChange={(e) => {
                  setFormData({ ...formData, date: e.target.value });
                  if (errors.date) setErrors({ ...errors, date: '' });
                }}
                required
              />
              {errors.date && <div className="err">{errors.date}</div>}
            </div>

            {/* Student Name */}
            <div className={`fld ${errors.name ? 'bad' : ''}`}>
              <label htmlFor="f-name">Student Name <em>*</em></label>
              <input
                ref={nameInputRef}
                className="input"
                id="f-name"
                name="name"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: '' });
                }}
                autoComplete="off"
              />
              {errors.name && <div className="err">{errors.name}</div>}
            </div>

            {/* Contact Number */}
            <div className={`fld ${errors.phone ? 'bad' : ''}`}>
              <label htmlFor="f-phone">Contact Number <em>*</em></label>
              <input
                className="input"
                id="f-phone"
                name="phone"
                placeholder="10 Digit Mobile Number"
                inputMode="tel"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (errors.phone) setErrors({ ...errors, phone: '' });
                }}
                onBlur={handlePhoneBlur}
                autoComplete="off"
              />
              {checkingPhone && <small style={{ color: '#64748b' }}>Checking contact history…</small>}
              {errors.phone && <div className="err">{errors.phone}</div>}
            </div>

            {/* Locality/Area */}
            <div className="fld">
              <label htmlFor="f-city">Locality/Area</label>
              <input
                className="input"
                id="f-city"
                name="city"
                placeholder="Locality"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                autoComplete="off"
              />
            </div>

            {/* Course Dropdown (Phase 2.3) */}
            <div className={`fld ${errors.course ? 'bad' : ''}`}>
              <label htmlFor="f-course">Course <em>*</em></label>
              <select
                className="select"
                id="f-course"
                name="course"
                value={formData.course}
                onChange={(e) => {
                  setFormData({ ...formData, course: e.target.value });
                  if (errors.course) setErrors({ ...errors, course: '' });
                }}
              >
                <option value="">Select Course</option>
                {coursesList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.course && <div className="err">{errors.course}</div>}
            </div>

            {/* Batch Time Options (Phase 2.4: 8:00 AM to 8:00 PM) */}
            <div className="fld">
              <label htmlFor="f-batch">Preferred Batch</label>
              <select
                className="select"
                id="f-batch"
                name="batch"
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
              >
                <option value="">Select Batch Slot</option>
                {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Lead Source Options (Phase 2.5) */}
            <div className="fld">
              <label htmlFor="f-source">Lead Source</label>
              <select
                className="select"
                id="f-source"
                name="source"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              >
                <option value="">Select Source</option>
                {STANDARDIZED_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Counselor */}
            <div className="fld">
              <label htmlFor="f-assigned">Assign Counselor</label>
              <select
                className="select"
                id="f-assigned"
                name="assignedTo"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
              >
                <option value="">Select Counselor</option>
                {uniqueCounselorList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Status (Phase 2.6) */}
            <div className="fld">
              <label htmlFor="f-status">Status</label>
              <select
                className="select"
                id="f-status"
                name="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Next Follow-up Date (Phase 2.7: Skips Sunday) */}
            <div className="fld">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label htmlFor="f-follow" style={{ margin: 0 }}>Next Follow-up</label>
                <button
                  type="button"
                  className="btn link sm"
                  style={{ padding: '0 4px', fontSize: '0.75rem', height: 'auto', minHeight: 'unset' }}
                  onClick={() => setFormData({ ...formData, followUpDate: getSuggestedFollowUpDate() })}
                  title="Auto suggest next working day (skips Sunday)"
                >
                  + Next Working Day
                </button>
              </div>
              <input
                className="input"
                id="f-follow"
                name="followUpDate"
                type="date"
                value={formData.followUpDate}
                onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              />
            </div>
          </div>

          {/* Remarks & Notes */}
          <div className="fld full" style={{ marginTop: '16px' }}>
            <label htmlFor="f-notes">Remarks / Notes</label>
            <div className="notes-wrap">
              <textarea
                className="textarea"
                id="f-notes"
                name="notes"
                rows="3"
                placeholder="Initial student inquiry notes or counseling conversation..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
              <button
                className={`mic-inline ${isListening ? 'on' : ''}`}
                type="button"
                aria-label="Dictate notes"
                onClick={startVoice}
                title="Speak notes into mic"
              >
                <span className="ic"><Icon name="mic" size={17} /></span>
              </button>
            </div>

            <div className="notes-tools">
              <label className="sr-only" htmlFor="voiceLang">Voice language</label>
              <select
                className="select sm"
                id="voiceLang"
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value)}
              >
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">हिन्दी (Hindi)</option>
                <option value="en-US">English (US)</option>
              </select>
              <span className="voice-state">{voiceState}</span>
              <button
                className="btn link sm"
                type="button"
                onClick={handleTranslate}
                disabled={translating}
              >
                <span className="ic"><Icon name="translate" size={15} /></span>
                {translating ? 'Translating…' : 'Translate'}
              </button>
            </div>

            {translation && (
              <div className="translate-box">
                <div className="tr-label">Translation (English)</div>
                <p>{translation}</p>
                <div className="tr-actions">
                  <button className="btn sm" type="button" onClick={handleInsertTranslation}>
                    Insert into notes
                  </button>
                  <button className="btn link sm" type="button" onClick={() => setTranslation(null)}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {translationError && <div className="err" style={{ marginTop: '6px' }}>{translationError}</div>}
          </div>

          {/* Form Actions */}
          <div className="form-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : (allowRepeatContact ? 'Add Additional Inquiry' : 'Save Enquiry')}
            </button>
            <button className="btn" type="button" onClick={handleClear} disabled={submitting}>
              Clear
            </button>
            {onCancel && (
              <button className="btn" type="button" onClick={onCancel} disabled={submitting}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
