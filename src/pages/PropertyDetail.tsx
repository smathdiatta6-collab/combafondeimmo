import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PROPERTIES } from '../data';
import { 
  MapPin, ArrowLeft, CheckCircle2, MessageCircle, Share2, Heart, 
  ChevronLeft, ChevronRight, Maximize2, X, Images, Bed, Bath, Tag, Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Property } from '../types';
import { useFirebase } from '../contexts/FirebaseContext';

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useFirebase();
  const [property, setProperty] = useState<Property | undefined>(PROPERTIES.find(p => p.id === id));
  const [loading, setLoading] = useState(!property);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchProperty = async () => {
      try {
        const docRef = doc(db, 'properties', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProperty({ id: docSnap.id, ...docSnap.data() } as Property);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching property from Firestore:', error);
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id]);

  // Gallery array
  const galleryImages: string[] = property
    ? (property.images && property.images.length > 0 ? property.images : [property.image])
    : [];

  const handlePrevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveImageIndex(prev => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveImageIndex(prev => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLightboxOpen) {
        if (e.key === 'Escape') setIsLightboxOpen(false);
        if (e.key === 'ArrowLeft') handlePrevImage();
        if (e.key === 'ArrowRight') handleNextImage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, galleryImages.length]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: property?.title,
          text: `Découvrez ce bien : ${property?.title} à ${property?.city} (${property?.price.toLocaleString()} FCFA)`,
          url: window.location.href,
        });
      } catch {
        // user cancelled or share failed
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (loading) {
    return <div className="pt-32 text-center text-gray-500 py-20">Chargement des détails du bien...</div>;
  }

  if (!property) {
    return (
      <div className="pt-32 text-center py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bien non trouvé</h2>
        <p className="text-gray-500 mb-6">Le bien demandé n'existe pas ou a été retiré.</p>
        <Link to="/biens" className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-colors">
          <ArrowLeft size={18} /> Retour à la liste des biens
        </Link>
      </div>
    );
  }

  const currentImageSrc = galleryImages[activeImageIndex] || property.image;

  return (
    <div className="pt-32 pb-24 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            Retour
          </button>

          {isAdmin && (
            <Link
              to={`/admin/biens?edit=${property.id}`}
              className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              <Pencil size={16} /> Modifier ce bien & ses photos
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Content: Interactive Photo Gallery & Description */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Gallery Main Container */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-video rounded-[2.5rem] overflow-hidden shadow-2xl bg-gray-900 group cursor-pointer"
                onClick={() => setIsLightboxOpen(true)}
              >
                <img
                  key={currentImageSrc}
                  src={currentImageSrc}
                  alt={`${property.title} - Photo ${activeImageIndex + 1}`}
                  className="w-full h-full object-cover transition-all duration-500"
                  referrerPolicy="no-referrer"
                />

                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />

                {/* Top Actions: Badges & Controls */}
                <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-10">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600/90 backdrop-blur-md text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-lg">
                      {property.type}
                    </span>
                    {galleryImages.length > 1 && (
                      <span className="bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-lg">
                        <Images size={14} /> {activeImageIndex + 1} / {galleryImages.length} photos
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setIsLiked(!isLiked)}
                      className={`p-3 backdrop-blur-md rounded-2xl transition-all shadow-lg ${
                        isLiked ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-900 hover:bg-white'
                      }`}
                      title={isLiked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      <Heart size={18} className={isLiked ? 'fill-white' : ''} />
                    </button>
                    <button
                      onClick={handleShare}
                      className="p-3 bg-white/90 backdrop-blur-md rounded-2xl text-gray-900 hover:bg-white transition-all shadow-lg relative"
                      title="Partager ce bien"
                    >
                      <Share2 size={18} />
                      {copiedLink && (
                        <span className="absolute -bottom-9 right-0 bg-black text-white text-xs px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap">
                          Lien copié !
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setIsLightboxOpen(true)}
                      className="p-3 bg-white/90 backdrop-blur-md rounded-2xl text-gray-900 hover:bg-white transition-all shadow-lg"
                      title="Agrandir en plein écran"
                    >
                      <Maximize2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Left/Right Navigation Arrows */}
                {galleryImages.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-white/80 hover:bg-white text-gray-900 flex items-center justify-center backdrop-blur-md transition-all shadow-lg opacity-0 group-hover:opacity-100 z-10"
                      title="Photo précédente"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-white/80 hover:bg-white text-gray-900 flex items-center justify-center backdrop-blur-md transition-all shadow-lg opacity-0 group-hover:opacity-100 z-10"
                      title="Photo suivante"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </>
                )}

                {/* Bottom hint */}
                <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-white/90 text-xs font-medium pointer-events-none">
                  <span>Cliquez pour afficher en plein écran</span>
                  <span className="hidden sm:inline">Toutes les pièces de la maison/appartement</span>
                </div>
              </motion.div>

              {/* Thumbnails Row */}
              {galleryImages.length > 1 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar">
                  {galleryImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative flex-shrink-0 w-24 sm:w-28 aspect-[4/3] rounded-2xl overflow-hidden transition-all ${
                        activeImageIndex === idx
                          ? 'ring-4 ring-blue-600 scale-105 shadow-md'
                          : 'opacity-60 hover:opacity-100 border border-gray-200'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Miniature ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-mono px-1 rounded">
                        #{idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Property Main Info */}
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-xl font-bold text-sm">
                    {property.type}
                  </span>
                  <div className="flex items-center gap-1 text-gray-500 font-medium">
                    <MapPin size={18} className="text-blue-600" />
                    {property.city}, Sénégal
                  </div>
                </div>
                
                {(property.bedrooms || property.bathrooms) && (
                  <div className="flex items-center gap-4 text-gray-600 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100 font-medium text-sm">
                    {property.bedrooms && (
                      <span className="flex items-center gap-1.5">
                        <Bed size={18} className="text-blue-600" /> {property.bedrooms} Chambres
                      </span>
                    )}
                    {property.bathrooms && (
                      <span className="flex items-center gap-1.5">
                        <Bath size={18} className="text-blue-600" /> {property.bathrooms} Salles de bain
                      </span>
                    )}
                  </div>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                {property.title}
              </h1>
              
              <div className="text-3xl font-black text-green-600">
                {property.price.toLocaleString()} FCFA
              </div>

              <div className="prose prose-lg max-w-none text-gray-600 leading-relaxed bg-gray-50/60 p-6 sm:p-8 rounded-3xl border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-3">À propos de ce logement</h3>
                <p className="whitespace-pre-line">{property.description}</p>
              </div>

              {property.features && property.features.length > 0 && (
                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Équipements & Caractéristiques</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {property.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <CheckCircle2 size={20} className="text-blue-600 flex-shrink-0" />
                        <span className="font-medium text-gray-700 text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Content: Contact Sidebar */}
          <div className="space-y-8">
            <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 sticky top-32 shadow-sm">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Intéressé par ce bien ?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Organisez une visite ou demandez plus de détails auprès de nos conseillers.
              </p>
              
              <div className="space-y-4 mb-8">
                <a
                  href={`https://wa.me/221775519683?text=Bonjour, je souhaite visiter le bien: ${encodeURIComponent(property.title)} situé à ${encodeURIComponent(property.city)} (Prix: ${property.price.toLocaleString()} FCFA).`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold hover:bg-[#1ebe5d] transition-all shadow-lg shadow-green-600/10 flex items-center justify-center gap-2 text-base"
                >
                  <MessageCircle size={20} />
                  WhatsApp Direct (Visite)
                </a>
                <a
                  href="tel:+221775519683"
                  className="w-full bg-blue-900 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 flex items-center justify-center gap-2 text-base text-center block"
                >
                  Appeler l'Agence
                </a>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-900 font-bold text-lg">
                    CF
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Coumba Fonde Immo</h4>
                    <p className="text-xs text-gray-500">Service Gestion & Vente</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 italic leading-relaxed">
                  "Nous vous accompagnons avec rigueur et transparence dans toutes les démarches administratives et visites sur place."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 sm:p-6"
            onClick={() => setIsLightboxOpen(false)}
          >
            {/* Header */}
            <div className="flex items-center justify-between text-white z-20" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">{property.title}</span>
                <span className="text-gray-400 text-sm">
                  ({activeImageIndex + 1} / {galleryImages.length})
                </span>
              </div>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                title="Fermer (Échap)"
              >
                <X size={24} />
              </button>
            </div>

            {/* Main Image in Lightbox */}
            <div className="relative flex-1 flex items-center justify-center p-2" onClick={e => e.stopPropagation()}>
              <img
                src={galleryImages[activeImageIndex]}
                alt={`${property.title} - Photo ${activeImageIndex + 1}`}
                className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
                referrerPolicy="no-referrer"
              />

              {/* Prev / Next buttons in Lightbox */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/30 text-white flex items-center justify-center transition-all backdrop-blur-md"
                    title="Photo précédente (Flèche gauche)"
                  >
                    <ChevronLeft size={32} />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/30 text-white flex items-center justify-center transition-all backdrop-blur-md"
                    title="Photo suivante (Flèche droite)"
                  >
                    <ChevronRight size={32} />
                  </button>
                </>
              )}
            </div>

            {/* Bottom thumbnail strip in Lightbox */}
            {galleryImages.length > 1 && (
              <div className="flex items-center justify-center gap-2 overflow-x-auto py-2 z-20" onClick={e => e.stopPropagation()}>
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-16 h-12 rounded-xl overflow-hidden transition-all ${
                      activeImageIndex === idx
                        ? 'ring-2 ring-blue-500 scale-110 opacity-100'
                        : 'opacity-40 hover:opacity-80'
                    }`}
                  >
                    <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

