import React, { useRef, useState } from 'react';
import Icon from './Icons';
import api from '../services/api';

export default function CsvUploader({ onImportSuccess, onToast }) {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      onToast("Please upload a valid CSV file.", true);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      setLoading(true);
      try {
        const text = event.target.result;
        const leads = parseCSV(text);
        if (leads.length === 0) {
          onToast("No valid leads found in CSV. Make sure you have 'name' and 'phone' columns.", true);
          return;
        }

        const res = await api.bulkCreateEnquiries(leads);
        onToast(res.message || `Successfully imported leads.`);
        if (onImportSuccess) onImportSuccess();
      } catch (err) {
        onToast(err.message || "Failed to process CSV file.", true);
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      onToast("Error reading file.", true);
      setLoading(false);
    };

    reader.readAsText(file);
  };

  // Simple CSV parser
  const parseCSV = (csvText) => {
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) return []; // Need at least header and one row

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    // Map expected columns to CSV headers
    const nameIdx = headers.findIndex(h => h.includes('name'));
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
    const emailIdx = headers.findIndex(h => h.includes('email'));
    const cityIdx = headers.findIndex(h => h.includes('city') || h.includes('area') || h.includes('local'));
    const courseIdx = headers.findIndex(h => h.includes('course'));
    const batchIdx = headers.findIndex(h => h.includes('batch'));
    const sourceIdx = headers.findIndex(h => h.includes('source'));
    
    if (nameIdx === -1 || phoneIdx === -1) {
      throw new Error("CSV must contain at least 'Name' and 'Phone' columns.");
    }

    const leads = [];
    for (let i = 1; i < lines.length; i++) {
      // Very basic regex split handling quotes
      const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
      if (row.length < headers.length && row.length < 2) continue; // skip empty rows
      
      const name = row[nameIdx];
      const phone = row[phoneIdx];
      
      if (!name || !phone) continue; // skip rows without name or phone

      leads.push({
        name,
        phone,
        email: emailIdx !== -1 ? row[emailIdx] : '',
        city: cityIdx !== -1 ? row[cityIdx] : '',
        course: courseIdx !== -1 ? row[courseIdx] : '',
        batch: batchIdx !== -1 ? row[batchIdx] : '',
        source: sourceIdx !== -1 ? row[sourceIdx] : '',
        status: 'New'
      });
    }
    
    return leads;
  };

  return (
    <>
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button 
        className="btn" 
        type="button" 
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        disabled={loading}
        title="Import Leads from CSV"
      >
        <span className={`ic ${loading ? 'spin' : ''}`}>
          <Icon name={loading ? "refresh" : "upload"} size={18} />
        </span>
        Import CSV
      </button>
    </>
  );
}
