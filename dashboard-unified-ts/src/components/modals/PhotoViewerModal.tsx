// Photo Viewer Modal Component - Toggle between Front and Side photos.
// Side photo can be processed or unprocessed; an edit icon opens a menu to choose which.
// Replace front/side photo (file or URL) and persist; side photo source preference is saved to Airtable.

import { useState, useEffect, useRef } from 'react';
import { Client } from '../../types';
import { fetchTableRecords, updateLeadRecord, uploadPatientPhoto } from '../../services/api';
import { showToast, showError } from '../../utils/toast';
import './PhotoViewerModal.css';

const SIDE_PROCESSED = 'Processed';
const SIDE_ORIGINAL_RIGHT = 'Original (right)';
const SIDE_ORIGINAL_LEFT = 'Original (left)';
const PREFERRED_SIDE_FIELD = 'Preferred Side Photo';
type SidePhotoSource = typeof SIDE_PROCESSED | typeof SIDE_ORIGINAL_RIGHT | typeof SIDE_ORIGINAL_LEFT;

const FRONT_PROCESSED = 'Processed';
const FRONT_ORIGINAL = 'Original';
const PREFERRED_FRONT_FIELD = 'Preferred Front Photo';
type FrontPhotoSource = typeof FRONT_PROCESSED | typeof FRONT_ORIGINAL;

function normalizeSidePreferred(val: unknown): SidePhotoSource | null {
  if (val === SIDE_PROCESSED || val === 'processed') return SIDE_PROCESSED;
  if (val === SIDE_ORIGINAL_RIGHT || val === 'unprocessedSide') return SIDE_ORIGINAL_RIGHT;
  if (val === SIDE_ORIGINAL_LEFT || val === 'unprocessedLeft') return SIDE_ORIGINAL_LEFT;
  return null;
}
function normalizeFrontPreferred(val: unknown): FrontPhotoSource | null {
  if (val === FRONT_PROCESSED || val === 'processed') return FRONT_PROCESSED;
  if (val === FRONT_ORIGINAL || val === 'original') return FRONT_ORIGINAL;
  return null;
}

function getAttachmentUrl(attachment: { thumbnails?: { full?: { url: string }; large?: { url: string } }; url?: string }): string | null {
  if (!attachment) return null;
  const url = attachment.thumbnails?.full?.url || attachment.thumbnails?.large?.url || attachment.url;
  return url || null;
}

function getFirstAttachmentUrl(fields: Record<string, unknown>, key: string): string | null {
  const val = fields[key];
  if (!val || !Array.isArray(val) || val.length === 0) return null;
  return getAttachmentUrl(val[0] as { thumbnails?: { full?: { url: string }; large?: { url: string } }; url?: string });
}

interface PhotoViewerModalProps {
  client: Client;
  initialPhotoType: 'front' | 'side';
  onClose: () => void;
  /** Called after a photo is replaced or side preference is saved so the parent can refresh client data. */
  onPhotoUpdated?: () => void;
}

const TABLES_WITH_PHOTOS = ['Patients', 'Web Popup Leads'] as const;
/** Set to true when backend photo upload is configured to show Replace front/side photo bar. */
const PHOTO_REPLACE_ENABLED = false;

export default function PhotoViewerModal({ client, initialPhotoType, onClose, onPhotoUpdated }: PhotoViewerModalProps) {
  const [photoType, setPhotoType] = useState<'front' | 'side'>(initialPhotoType);
  const [sidePhotoSource, setSidePhotoSource] = useState<SidePhotoSource>(SIDE_PROCESSED);
  const [frontPhotoSource, setFrontPhotoSource] = useState<FrontPhotoSource>(FRONT_PROCESSED);
  const [frontPhotoUrl, setFrontPhotoUrl] = useState<string | null>(null);
  const [frontPhotoFromFormUrl, setFrontPhotoFromFormUrl] = useState<string | null>(null);
  const [sidePhotoUrl, setSidePhotoUrl] = useState<string | null>(null);
  const [sidePhotoUnprocessedSideUrl, setSidePhotoUnprocessedSideUrl] = useState<string | null>(null);
  const [sidePhotoUnprocessedLeftUrl, setSidePhotoUnprocessedLeftUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSideSourceMenu, setShowSideSourceMenu] = useState(false);
  const [showFrontSourceMenu, setShowFrontSourceMenu] = useState(false);
  const [replacing, setReplacing] = useState<'front' | 'side' | null>(null);
  const [replaceUrl, setReplaceUrl] = useState('');
  const [showReplaceUrl, setShowReplaceUrl] = useState(false);
  const sideSourceMenuRef = useRef<HTMLDivElement>(null);
  const frontSourceMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = async () => {
    if (!TABLES_WITH_PHOTOS.includes(client.tableSource as any)) return;

    setLoading(true);
    try {
      const records = await fetchTableRecords(client.tableSource, {
        filterFormula: `RECORD_ID() = "${client.id}"`,
        fields: [
          'Front Photo',
          'Front Photo (from Form Submissions)',
          'Side Photo',
          'Side Photo (from Form Submissions)',
          'Left Side Photo (from Form Submissions)',
          PREFERRED_FRONT_FIELD,
          PREFERRED_SIDE_FIELD,
        ],
      });

      if (records.length > 0) {
        const fields = records[0].fields as Record<string, unknown>;

        const front = fields['Front Photo'] || fields['Front photo'] || fields['frontPhoto'];
        if (front && Array.isArray(front) && front.length > 0) {
          setFrontPhotoUrl(getAttachmentUrl((front as { thumbnails?: { full?: { url: string }; large?: { url: string } }; url?: string }[])[0]));
        } else {
          setFrontPhotoUrl(null);
        }
        setFrontPhotoFromFormUrl(getFirstAttachmentUrl(fields, 'Front Photo (from Form Submissions)'));

        const side = fields['Side Photo'] || fields['Side photo'] || fields['sidePhoto'];
        if (side && Array.isArray(side) && side.length > 0) {
          setSidePhotoUrl(getAttachmentUrl((side as { thumbnails?: { full?: { url: string }; large?: { url: string } }; url?: string }[])[0]));
        } else {
          setSidePhotoUrl(null);
        }

        setSidePhotoUnprocessedSideUrl(getFirstAttachmentUrl(fields, 'Side Photo (from Form Submissions)'));
        setSidePhotoUnprocessedLeftUrl(getFirstAttachmentUrl(fields, 'Left Side Photo (from Form Submissions)'));

        const preferredSide = normalizeSidePreferred(fields[PREFERRED_SIDE_FIELD]);
        if (preferredSide) setSidePhotoSource(preferredSide);

        const preferredFront = normalizeFrontPreferred(fields[PREFERRED_FRONT_FIELD]);
        if (preferredFront) setFrontPhotoSource(preferredFront);
      }
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [client.id, client.tableSource]);

  useEffect(() => {
    setReplacing(null);
    setShowReplaceUrl(false);
    setReplaceUrl('');
  }, [photoType]);

  // Reset side source when switching to side and current source isn't available
  useEffect(() => {
    if (photoType !== 'side') return;
    if (sidePhotoSource === SIDE_PROCESSED && !sidePhotoUrl) {
      if (sidePhotoUnprocessedSideUrl) setSidePhotoSource(SIDE_ORIGINAL_RIGHT);
      else if (sidePhotoUnprocessedLeftUrl) setSidePhotoSource(SIDE_ORIGINAL_LEFT);
    } else if (sidePhotoSource === SIDE_ORIGINAL_RIGHT && !sidePhotoUnprocessedSideUrl) {
      if (sidePhotoUrl) setSidePhotoSource(SIDE_PROCESSED);
      else if (sidePhotoUnprocessedLeftUrl) setSidePhotoSource(SIDE_ORIGINAL_LEFT);
    } else if (sidePhotoSource === SIDE_ORIGINAL_LEFT && !sidePhotoUnprocessedLeftUrl) {
      if (sidePhotoUrl) setSidePhotoSource(SIDE_PROCESSED);
      else if (sidePhotoUnprocessedSideUrl) setSidePhotoSource(SIDE_ORIGINAL_RIGHT);
    }
  }, [photoType, sidePhotoSource, sidePhotoUrl, sidePhotoUnprocessedSideUrl, sidePhotoUnprocessedLeftUrl]);

  // Reset front source when current source isn't available
  useEffect(() => {
    if (photoType !== 'front') return;
    if (frontPhotoSource === FRONT_PROCESSED && !frontPhotoUrl && frontPhotoFromFormUrl) {
      setFrontPhotoSource(FRONT_ORIGINAL);
    } else if (frontPhotoSource === FRONT_ORIGINAL && !frontPhotoFromFormUrl && frontPhotoUrl) {
      setFrontPhotoSource(FRONT_PROCESSED);
    }
  }, [photoType, frontPhotoSource, frontPhotoUrl, frontPhotoFromFormUrl]);

  const persistSidePhotoPreference = async (source: SidePhotoSource) => {
    if (!TABLES_WITH_PHOTOS.includes(client.tableSource as any)) return;
    try {
      await updateLeadRecord(client.id, client.tableSource, { [PREFERRED_SIDE_FIELD]: source });
      showToast('Side photo preference saved');
      onPhotoUpdated?.();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to save preference');
    }
  };

  const persistFrontPhotoPreference = async (source: FrontPhotoSource) => {
    if (!TABLES_WITH_PHOTOS.includes(client.tableSource as any)) return;
    try {
      await updateLeadRecord(client.id, client.tableSource, { [PREFERRED_FRONT_FIELD]: source });
      showToast('Front photo preference saved');
      onPhotoUpdated?.();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to save preference');
    }
  };

  const replacePhotoWithUrl = async (fieldName: 'Front Photo' | 'Side Photo', url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try {
      await updateLeadRecord(client.id, client.tableSource, {
        [fieldName]: [{ url: trimmed }],
      });
      showToast(`${fieldName} updated`);
      setReplacing(null);
      setReplaceUrl('');
      setShowReplaceUrl(false);
      await loadPhotos();
      onPhotoUpdated?.();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to update photo');
    }
  };

  const MAX_PHOTO_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB – under typical server limits (e.g. Vercel 4.5MB)

  const replacePhotoWithFile = async (fieldName: 'Front Photo' | 'Side Photo', file: File) => {
    if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
      showError(
        `Photo is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 4 MB. Use a smaller image or "Paste URL" to use a link.`
      );
      return;
    }
    try {
      const { url } = await uploadPatientPhoto(client.id, client.tableSource, fieldName, file);
      await updateLeadRecord(client.id, client.tableSource, {
        [fieldName]: [{ url }],
      });
      showToast(`${fieldName} updated`);
      setReplacing(null);
      await loadPhotos();
      onPhotoUpdated?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to upload photo';
      const isNotConfigured =
        /not configured|501|CORS|Failed to fetch|NetworkError/i.test(msg) ||
        msg.includes('upload-patient-photo');
      const isTooLarge = /413|too large|Content Too Large/i.test(msg);
      showError(
        isNotConfigured
          ? "Photo upload isn't available on this server. Use \"Paste URL\" below to add a photo from a link."
          : isTooLarge
            ? "Photo is too large for the server. Use a smaller image (under 4 MB) or \"Paste URL\" to use a link."
            : msg
      );
    }
  };

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'Front Photo' | 'Side Photo') => {
    const file = e.target.files?.[0];
    if (file) {
      replacePhotoWithFile(fieldName, file);
      e.target.value = '';
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSideSourceMenu(false);
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    if (!showSideSourceMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sideSourceMenuRef.current && !sideSourceMenuRef.current.contains(e.target as Node)) {
        setShowSideSourceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSideSourceMenu]);

  useEffect(() => {
    if (!showFrontSourceMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (frontSourceMenuRef.current && !frontSourceMenuRef.current.contains(e.target as Node)) {
        setShowFrontSourceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFrontSourceMenu]);

  const currentFrontUrl =
    frontPhotoSource === FRONT_ORIGINAL && frontPhotoFromFormUrl
      ? frontPhotoFromFormUrl
      : frontPhotoUrl;
  const currentSideUrl =
    sidePhotoSource === SIDE_PROCESSED
      ? sidePhotoUrl
      : sidePhotoSource === SIDE_ORIGINAL_RIGHT
        ? sidePhotoUnprocessedSideUrl
        : sidePhotoUnprocessedLeftUrl;
  const currentPhotoUrl = photoType === 'front' ? currentFrontUrl : currentSideUrl;
  const hasFrontPhoto = frontPhotoUrl !== null || frontPhotoFromFormUrl !== null;
  const hasSidePhoto = !!(sidePhotoUrl || sidePhotoUnprocessedSideUrl || sidePhotoUnprocessedLeftUrl);
  const hasProcessedFront = frontPhotoUrl !== null;
  const hasOriginalFront = frontPhotoFromFormUrl !== null;
  const hasMultipleFrontOptions = hasProcessedFront && hasOriginalFront;
  const hasProcessedSide = sidePhotoUrl !== null;
  const hasUnprocessedSide = sidePhotoUnprocessedSideUrl !== null;
  const hasUnprocessedLeft = sidePhotoUnprocessedLeftUrl !== null;
  const hasMultipleSideOptions = [hasProcessedSide, hasUnprocessedSide, hasUnprocessedLeft].filter(Boolean).length > 1;

  return (
    <div className="modal-overlay active photo-viewer-overlay" onClick={onClose}>
      <div className="modal-content photo-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="photo-viewer-header">
          <div className="photo-viewer-title">
            <h2>{client.name}</h2>
            <div className="photo-viewer-toggles">
              <div className="photo-toggle-buttons photo-viewer-main-toggles">
                <button
                  type="button"
                  className={`photo-toggle-btn ${photoType === 'front' ? 'active' : ''}`}
                  onClick={() => setPhotoType('front')}
                  disabled={!hasFrontPhoto}
                >
                  Front Photo
                </button>
                {photoType === 'front' && hasMultipleFrontOptions && (
                  <div className="photo-viewer-side-source-wrap" ref={frontSourceMenuRef}>
                    <button
                      type="button"
                      className="photo-viewer-side-source-edit-btn"
                      onClick={() => setShowFrontSourceMenu((v) => !v)}
                      title="Choose front photo"
                      aria-label="Choose which front photo to show"
                      aria-expanded={showFrontSourceMenu}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    {showFrontSourceMenu && (
                      <div className="photo-viewer-side-source-menu" role="menu">
                        {hasProcessedFront && (
                          <button
                            type="button"
                            role="menuitem"
                            className={`photo-viewer-side-source-item ${frontPhotoSource === FRONT_PROCESSED ? 'active' : ''}`}
                            onClick={() => {
                              setFrontPhotoSource(FRONT_PROCESSED);
                              setShowFrontSourceMenu(false);
                              persistFrontPhotoPreference(FRONT_PROCESSED);
                            }}
                          >
                            Processed
                          </button>
                        )}
                        {hasOriginalFront && (
                          <button
                            type="button"
                            role="menuitem"
                            className={`photo-viewer-side-source-item ${frontPhotoSource === FRONT_ORIGINAL ? 'active' : ''}`}
                            onClick={() => {
                              setFrontPhotoSource(FRONT_ORIGINAL);
                              setShowFrontSourceMenu(false);
                              persistFrontPhotoPreference(FRONT_ORIGINAL);
                            }}
                          >
                            Original (from Form Submissions)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className={`photo-toggle-btn ${photoType === 'side' ? 'active' : ''}`}
                  onClick={() => setPhotoType('side')}
                  disabled={!hasSidePhoto}
                >
                  Side Photo
                </button>
                {photoType === 'side' && hasMultipleSideOptions && (
                  <div className="photo-viewer-side-source-wrap" ref={sideSourceMenuRef}>
                    <button
                      type="button"
                      className="photo-viewer-side-source-edit-btn"
                      onClick={() => setShowSideSourceMenu((v) => !v)}
                      title="Choose side photo"
                      aria-label="Choose which side photo to show"
                      aria-expanded={showSideSourceMenu}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    {showSideSourceMenu && (
                      <div className="photo-viewer-side-source-menu" role="menu">
                        {hasProcessedSide && (
                          <button
                            type="button"
                            role="menuitem"
                            className={`photo-viewer-side-source-item ${sidePhotoSource === SIDE_PROCESSED ? 'active' : ''}`}
                            onClick={() => {
                              setSidePhotoSource(SIDE_PROCESSED);
                              setShowSideSourceMenu(false);
                              persistSidePhotoPreference(SIDE_PROCESSED);
                            }}
                          >
                            Processed
                          </button>
                        )}
                        {hasUnprocessedSide && (
                          <button
                            type="button"
                            role="menuitem"
                            className={`photo-viewer-side-source-item ${sidePhotoSource === SIDE_ORIGINAL_RIGHT ? 'active' : ''}`}
                            onClick={() => {
                              setSidePhotoSource(SIDE_ORIGINAL_RIGHT);
                              setShowSideSourceMenu(false);
                              persistSidePhotoPreference(SIDE_ORIGINAL_RIGHT);
                            }}
                          >
                            Original (right)
                          </button>
                        )}
                        {hasUnprocessedLeft && (
                          <button
                            type="button"
                            role="menuitem"
                            className={`photo-viewer-side-source-item ${sidePhotoSource === SIDE_ORIGINAL_LEFT ? 'active' : ''}`}
                            onClick={() => {
                              setSidePhotoSource(SIDE_ORIGINAL_LEFT);
                              setShowSideSourceMenu(false);
                              persistSidePhotoPreference(SIDE_ORIGINAL_LEFT);
                            }}
                          >
                            Original (left)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
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

        {PHOTO_REPLACE_ENABLED && TABLES_WITH_PHOTOS.includes(client.tableSource as any) && !loading && (
          <div className="photo-viewer-footer">
            <div className="photo-viewer-replace">
              {replacing === (photoType === 'front' ? 'front' : 'side') ? (
                <div className="photo-viewer-replace-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="photo-viewer-replace-file-input"
                    aria-label={`Upload new ${photoType} photo`}
                    onChange={(e) => {
                      handleReplaceFileChange(e, photoType === 'front' ? 'Front Photo' : 'Side Photo');
                    }}
                  />
                  <button
                    type="button"
                    className="photo-viewer-replace-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload file
                  </button>
                  <button
                    type="button"
                    className="photo-viewer-replace-btn"
                    onClick={() => setShowReplaceUrl((v) => !v)}
                  >
                    {showReplaceUrl ? 'Hide URL' : 'Paste URL'}
                  </button>
                  {showReplaceUrl && (
                    <div className="photo-viewer-replace-url-wrap">
                      <input
                        type="url"
                        className="photo-viewer-replace-url-input"
                        placeholder="https://..."
                        value={replaceUrl}
                        onChange={(e) => setReplaceUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            replacePhotoWithUrl(photoType === 'front' ? 'Front Photo' : 'Side Photo', replaceUrl);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="photo-viewer-replace-btn photo-viewer-replace-btn-primary"
                        onClick={() => replacePhotoWithUrl(photoType === 'front' ? 'Front Photo' : 'Side Photo', replaceUrl)}
                      >
                        Save URL
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="photo-viewer-replace-btn photo-viewer-replace-cancel"
                    onClick={() => {
                      setReplacing(null);
                      setShowReplaceUrl(false);
                      setReplaceUrl('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="photo-viewer-replace-btn"
                  onClick={() => setReplacing(photoType === 'front' ? 'front' : 'side')}
                >
                  Replace {photoType === 'front' ? 'front' : 'side'} photo
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
