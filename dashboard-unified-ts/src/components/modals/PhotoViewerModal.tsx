// Photo Viewer Modal Component - Toggle between Front and Side photos

import { useState, useEffect } from 'react';
import { Client } from '../../types';
import { fetchTableRecords } from '../../services/api';
import './PhotoViewerModal.css';

interface PhotoViewerModalProps {
  client: Client;
  initialPhotoType: 'front' | 'side';
  onClose: () => void;
}

export default function PhotoViewerModal({ client, initialPhotoType, onClose }: PhotoViewerModalProps) {
  const [photoType, setPhotoType] = useState<'front' | 'side'>(initialPhotoType);
  const [frontPhotoUrl, setFrontPhotoUrl] = useState<string | null>(null);
  const [sidePhotoUrl, setSidePhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPhotos = async () => {
      if (client.tableSource !== 'Patients') return;

      setLoading(true);
      try {
        const records = await fetchTableRecords('Patients', {
          filterFormula: `RECORD_ID() = "${client.id}"`,
          fields: ['Front Photo', 'Side Photo'],
        });

        if (records.length > 0) {
          const record = records[0];
          const fields = record.fields;

          // Get front photo
          const frontPhoto = fields['Front Photo'] || fields['Front photo'] || fields['frontPhoto'];
          if (frontPhoto && Array.isArray(frontPhoto) && frontPhoto.length > 0) {
            const attachment = frontPhoto[0];
            const url = attachment.thumbnails?.full?.url || 
                       attachment.thumbnails?.large?.url ||
                       attachment.url;
            setFrontPhotoUrl(url);
          }

          // Get side photo
          const sidePhoto = fields['Side Photo'] || fields['Side photo'] || fields['sidePhoto'];
          if (sidePhoto && Array.isArray(sidePhoto) && sidePhoto.length > 0) {
            const attachment = sidePhoto[0];
            const url = attachment.thumbnails?.full?.url || 
                       attachment.thumbnails?.large?.url ||
                       attachment.url;
            setSidePhotoUrl(url);
          }
        }
      } catch (error) {
        console.error('Error loading photos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPhotos();
  }, [client]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const currentPhotoUrl = photoType === 'front' ? frontPhotoUrl : sidePhotoUrl;
  const hasFrontPhoto = frontPhotoUrl !== null;
  const hasSidePhoto = sidePhotoUrl !== null;

  return (
    <div className="modal-overlay active photo-viewer-overlay" onClick={onClose}>
      <div className="modal-content photo-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="photo-viewer-header">
          <div className="photo-viewer-title">
            <h2>{client.name}</h2>
            <div className="photo-toggle-buttons">
              <button
                type="button"
                className={`photo-toggle-btn ${photoType === 'front' ? 'active' : ''}`}
                onClick={() => setPhotoType('front')}
                disabled={!hasFrontPhoto}
              >
                Front Photo
              </button>
              <button
                type="button"
                className={`photo-toggle-btn ${photoType === 'side' ? 'active' : ''}`}
                onClick={() => setPhotoType('side')}
                disabled={!hasSidePhoto}
              >
                Side Photo
              </button>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="photo-viewer-body">
          {loading ? (
            <div className="photo-viewer-loading">
              <div className="spinner spinner-inline spinner-margin-right"></div>
              Loading photos...
            </div>
          ) : currentPhotoUrl ? (
            <div className="photo-viewer-image-container">
              <img 
                src={currentPhotoUrl} 
                alt={`${client.name} - ${photoType === 'front' ? 'Front' : 'Side'} Photo`}
                className="photo-viewer-image"
              />
            </div>
          ) : (
            <div className="photo-viewer-empty">
              <p>No {photoType === 'front' ? 'front' : 'side'} photo available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
