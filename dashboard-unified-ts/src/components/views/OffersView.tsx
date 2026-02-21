import { useState, useEffect } from 'react';
import { fetchOffers } from '../../services/api';
import { Offer } from '../../types';
import OfferRequestModal from '../modals/OfferRequestModal';
import './OffersView.css';

type OfferModalState = { open: false } | { open: true; mode: 'add' } | { open: true; mode: 'edit'; offer: Offer };

export default function OffersView() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offerModal, setOfferModal] = useState<OfferModalState>({ open: false });

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      setLoading(true);
      const data = await fetchOffers();
      setOffers(data);
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to load offers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddOffer = () => {
    setOfferModal({ open: true, mode: 'add' });
  };

  const handleEditOffer = (offer: Offer) => {
    setOfferModal({ open: true, mode: 'edit', offer });
  };

  if (loading) {
    return (
      <div className="offers-view">
        <div className="loading-container">
          <div className="spinner spinner-with-margin"></div>
          Loading offers...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="offers-view">
        <div className="error-container">
          <p>Error loading offers: {error}</p>
          <button onClick={loadOffers} className="error-retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="offers-view">
      <div className="offers-header">
        <h1 className="offers-title">Offers</h1>
        <button className="btn-add-offer" onClick={handleAddOffer}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Offer
        </button>
      </div>

      <div className="offers-grid">
        {offers.length === 0 ? (
          <div className="no-offers">
            No offers found. Click "Add Offer" to create one.
          </div>
        ) : (
          offers.map(offer => (
            <div key={offer.id} className="offer-card">
              <div className="offer-header">
                <div>
                  <h3 className="offer-name">{offer.name}</h3>
                  <div className="offer-heading">{offer.heading}</div>
                </div>
              </div>

              <div className="offer-details">
                <p className="offer-description">{offer.details}</p>

                <div className="offer-meta">
                  <div className="offer-meta-item">
                    <span className="offer-meta-label">Available Until:</span>
                    <span>{offer.availableUntil}</span>
                  </div>
                  <div className="offer-meta-item">
                    <span className="offer-meta-label">Redemption Period:</span>
                    <span>{offer.redemptionPeriod}</span>
                  </div>
                  <div className="offer-meta-item">
                    <span className="offer-meta-label">Applies To:</span>
                    <span>{offer.treatmentFilter}</span>
                  </div>
                </div>
              </div>

              <div className="offer-footer">
                <button
                  className="btn-edit-offer"
                  onClick={() => handleEditOffer(offer)}
                >
                  Edit Offer
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {offerModal.open && (
        <OfferRequestModal
          onClose={() => setOfferModal({ open: false })}
          mode={offerModal.mode}
          initialOffer={offerModal.mode === 'edit' ? offerModal.offer : null}
        />
      )}
    </div>
  );
}
