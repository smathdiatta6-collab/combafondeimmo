import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, getDocs } from 'firebase/firestore';
import { Property } from '../types';
import { PROPERTIES } from '../data';
import { compressImage } from '../utils/imageUtils';
import { 
  Plus, Pencil, Trash2, X, Upload, Home, MapPin, Tag, Info, Bed, Bath, 
  Database, Images, Star, ImagePlus, ArrowLeft, ArrowRight, Loader2, Link2, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate, Link } from 'react-router-dom';

const AdminProperties: React.FC = () => {
  const { user, isAdmin, isSuperAdmin, loading } = useFirebase();
  const location = useLocation();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState<Partial<Property>>({
    title: '',
    city: '',
    type: 'Appartement',
    price: 0,
    description: '',
    features: [],
    image: '',
    images: [],
    bedrooms: 0,
    bathrooms: 0
  });
  const [featureInput, setFeatureInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'properties'), orderBy('title'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setProperties(data);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'properties');
      }
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const handleMultipleImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    try {
      const compressedList: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const base64 = await compressImage(file, 1280, 960, 0.78);
          compressedList.push(base64);
        }
      }

      if (compressedList.length > 0) {
        setFormData(prev => {
          const currentImages = prev.images || (prev.image ? [prev.image] : []);
          const combined = [...currentImages, ...compressedList];
          const primaryImage = prev.image || combined[0] || '';
          setImagePreview(primaryImage);
          return {
            ...prev,
            image: primaryImage,
            images: combined
          };
        });
      }
    } catch (err) {
      console.error('Error processing images:', err);
      alert('Erreur lors du traitement des images. Veuillez réessayer avec des photos valides.');
    } finally {
      setIsUploadingImages(false);
      // Reset input value so same files can be re-selected if needed
      e.target.value = '';
    }
  };

  const handleAddImageUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    const url = urlInput.trim();
    setFormData(prev => {
      const currentImages = prev.images || (prev.image ? [prev.image] : []);
      const combined = [...currentImages, url];
      const primaryImage = prev.image || url;
      setImagePreview(primaryImage);
      return {
        ...prev,
        image: primaryImage,
        images: combined
      };
    });
    setUrlInput('');
    setShowUrlInput(false);
  };

  const setAsCoverImage = (imgSrc: string) => {
    setImagePreview(imgSrc);
    setFormData(prev => {
      const currentImages = prev.images || [];
      // Move this image to the front of images array
      const filtered = currentImages.filter(img => img !== imgSrc);
      return {
        ...prev,
        image: imgSrc,
        images: [imgSrc, ...filtered]
      };
    });
  };

  const removeImage = (indexToRemove: number) => {
    setFormData(prev => {
      const currentImages = [...(prev.images || (prev.image ? [prev.image] : []))];
      currentImages.splice(indexToRemove, 1);
      const newCover = currentImages[0] || '';
      setImagePreview(newCover);
      return {
        ...prev,
        image: newCover,
        images: currentImages
      };
    });
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    setFormData(prev => {
      const currentImages = [...(prev.images || [])];
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= currentImages.length) return prev;
      
      const temp = currentImages[index];
      currentImages[index] = currentImages[targetIndex];
      currentImages[targetIndex] = temp;
      
      const newCover = currentImages[0] || '';
      setImagePreview(newCover);
      return {
        ...prev,
        image: newCover,
        images: currentImages
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!formData.image && (!formData.images || formData.images.length === 0)) {
      alert('Veuillez ajouter au moins une photo pour le bien.');
      return;
    }

    try {
      const imagesList = formData.images && formData.images.length > 0 
        ? formData.images 
        : (formData.image ? [formData.image] : []);
      
      const coverImage = formData.image || imagesList[0] || '';

      const dataToSave = {
        ...formData,
        image: coverImage,
        images: imagesList,
        price: Number(formData.price),
        bedrooms: Number(formData.bedrooms) || 0,
        bathrooms: Number(formData.bathrooms) || 0,
      };

      if (editingProperty) {
        await updateDoc(doc(db, 'properties', editingProperty.id), dataToSave);
      } else {
        await addDoc(collection(db, 'properties'), dataToSave);
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingProperty ? OperationType.UPDATE : OperationType.CREATE, 'properties');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !window.confirm('Voulez-vous vraiment supprimer ce bien ?')) return;
    try {
      await deleteDoc(doc(db, 'properties', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `properties/${id}`);
    }
  };

  const openModal = (property?: Property) => {
    if (property) {
      setEditingProperty(property);
      const allImages = property.images && property.images.length > 0 
        ? property.images 
        : (property.image ? [property.image] : []);
      setFormData({
        ...property,
        images: allImages
      });
      setImagePreview(property.image || allImages[0] || null);
    } else {
      setEditingProperty(null);
      setFormData({
        title: '',
        city: '',
        type: 'Appartement',
        price: 0,
        description: '',
        features: [],
        image: '',
        images: [],
        bedrooms: 0,
        bathrooms: 0
      });
      setImagePreview(null);
    }
    setUrlInput('');
    setShowUrlInput(false);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = params.get('edit');
    if (editId && properties.length > 0) {
      const propertyToEdit = properties.find(p => p.id === editId);
      if (propertyToEdit) {
        openModal(propertyToEdit);
        // Clear the query param without reloading
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.search, properties, navigate]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProperty(null);
    setFormData({});
    setImagePreview(null);
    setFeatureInput('');
    setUrlInput('');
    setShowUrlInput(false);
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      setFormData({
        ...formData,
        features: [...(formData.features || []), featureInput.trim()]
      });
      setFeatureInput('');
    }
  };

  const removeFeature = (index: number) => {
    const newFeatures = [...(formData.features || [])];
    newFeatures.splice(index, 1);
    setFormData({ ...formData, features: newFeatures });
  };

  const migrateData = async () => {
    if (!isAdmin || isMigrating) return;
    if (!window.confirm('Voulez-vous importer les biens initiaux du site dans la base de données ? Cela vous permettra de les modifier et de charger plusieurs photos.')) return;

    setIsMigrating(true);
    try {
      const propsCollection = collection(db, 'properties');
      const existingDocs = await getDocs(propsCollection);
      
      // Filter out properties that might already be in Firestore (by title)
      const existingTitles = new Set(existingDocs.docs.map(doc => doc.data().title));
      const toMigrate = PROPERTIES.filter(p => !existingTitles.has(p.title));

      if (toMigrate.length === 0) {
        alert('Tous les biens initiaux sont déjà dans la base de données.');
        setIsMigrating(false);
        return;
      }

      for (const prop of toMigrate) {
        const { id, ...dataWithoutId } = prop;
        await addDoc(propsCollection, dataWithoutId);
      }
      alert(`${toMigrate.length} biens ont été importés avec succès.`);
    } catch (error) {
      console.error('Migration error:', error);
      alert('Erreur lors de l\'importation des données.');
    } finally {
      setIsMigrating(false);
    }
  };

  if (loading) return <div className="pt-32 text-center">Chargement...</div>;
  if (!user || !isAdmin) return <div className="pt-32 text-center">Accès refusé.</div>;

  const currentGalleryImages = formData.images || (formData.image ? [formData.image] : []);

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Gestion des Biens & Galeries Photos</h1>
            <p className="text-gray-600">Ajoutez, modifiez ou supprimez des biens avec plusieurs photos détaillées (salon, chambres, cuisine, terrasse, etc.).</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={migrateData}
              disabled={isMigrating}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50 text-sm"
            >
              <Database size={18} />
              {isMigrating ? 'Importation...' : 'Importer Biens Initiaux'}
            </button>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg text-sm"
            >
              <Plus size={18} />
              Ajouter un Bien
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties.map((property) => {
            const photoCount = property.images && property.images.length > 0 ? property.images.length : (property.image ? 1 : 0);
            return (
              <div key={property.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 group hover:shadow-md transition-shadow">
                <div className="relative aspect-video overflow-hidden">
                  <img src={property.image} alt={property.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  
                  {/* Photo count badge */}
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                    <Images size={14} />
                    {photoCount} photo{photoCount > 1 ? 's' : ''}
                  </div>

                  <div className="absolute top-4 right-4 flex gap-2">
                    <button
                      onClick={() => openModal(property)}
                      className="p-2 bg-white/90 backdrop-blur-sm text-blue-600 rounded-xl hover:bg-white transition-colors shadow-sm"
                      title="Modifier le bien et ses photos"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(property.id)}
                      className="p-2 bg-white/90 backdrop-blur-sm text-red-600 rounded-xl hover:bg-white transition-colors shadow-sm"
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-lg">
                    {property.type}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{property.title}</h3>
                  <div className="flex items-center gap-1 text-gray-500 text-sm mb-4">
                    <MapPin size={14} />
                    {property.city}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <div className="text-green-600 font-bold text-lg">
                      {property.price.toLocaleString()} FCFA
                    </div>
                    <Link
                      to={`/biens/${property.id}`}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-xl"
                    >
                      <Eye size={14} /> Aperçu public
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[2.5rem] w-full max-w-5xl my-8 max-h-[90vh] overflow-y-auto shadow-2xl"
              >
                <div className="p-6 sm:p-8">
                  <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                        {editingProperty ? 'Modifier le Bien' : 'Nouveau Bien'}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Chargez plusieurs photos pour montrer les différentes pièces (salon, chambres, cuisine, etc.).
                      </p>
                    </div>
                    <button onClick={closeModal} className="p-2.5 hover:bg-gray-100 rounded-full transition-colors">
                      <X size={24} />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Left Column: Info (5 cols) */}
                      <div className="lg:col-span-5 space-y-6">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Home size={16} /> Titre du Bien
                          </label>
                          <input
                            type="text"
                            required
                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Ex: Villa de Luxe aux Almadies"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                              <MapPin size={16} /> Ville
                            </label>
                            <input
                              type="text"
                              required
                              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                              value={formData.city}
                              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                              placeholder="Dakar, Thiès..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                              <Tag size={16} /> Type
                            </label>
                            <select
                              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                              value={formData.type}
                              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                            >
                              <option value="Appartement">Appartement</option>
                              <option value="Villa">Villa</option>
                              <option value="Maison">Maison</option>
                              <option value="Terrain">Terrain</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Prix (FCFA)</label>
                          <input
                            type="number"
                            required
                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                              <Bed size={16} /> Chambres
                            </label>
                            <input
                              type="number"
                              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                              value={formData.bedrooms}
                              onChange={(e) => setFormData({ ...formData, bedrooms: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                              <Bath size={16} /> Salles de bain
                            </label>
                            <input
                              type="number"
                              className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                              value={formData.bathrooms}
                              onChange={(e) => setFormData({ ...formData, bathrooms: Number(e.target.value) })}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Info size={16} /> Description détaillée
                          </label>
                          <textarea
                            required
                            rows={4}
                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Décrivez les atouts du bien, agencement des pièces, équipements..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Points forts & Caractéristiques</label>
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              className="flex-grow px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              value={featureInput}
                              onChange={(e) => setFeatureInput(e.target.value)}
                              placeholder="Ex: Piscine, Grand Salon, Climatisation..."
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                            />
                            <button
                              type="button"
                              onClick={addFeature}
                              className="bg-gray-900 text-white px-4 rounded-2xl hover:bg-gray-800 transition-colors text-sm font-bold"
                            >
                              Ajouter
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {formData.features?.map((feature, index) => (
                              <span
                                key={index}
                                className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                              >
                                {feature}
                                <button type="button" onClick={() => removeFeature(index)} className="hover:text-blue-900">
                                  <X size={13} />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Multi-Image Gallery Manager (7 cols) */}
                      <div className="lg:col-span-7 space-y-6 bg-gray-50/70 p-6 rounded-3xl border border-gray-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-base font-bold text-gray-900 flex items-center gap-2">
                              <Images size={20} className="text-blue-600" /> Galerie Photos du Bien ({currentGalleryImages.length})
                            </label>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Ajoutez plusieurs images : façade, salon, cuisine, chambres, sanitaires, terrasse...
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowUrlInput(!showUrlInput)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-gray-200"
                          >
                            <Link2 size={13} /> {showUrlInput ? 'Fermer URL' : 'Ajouter par URL'}
                          </button>
                        </div>

                        {/* URL input drawer */}
                        {showUrlInput && (
                          <div className="bg-white p-4 rounded-2xl border border-blue-100 flex gap-2">
                            <input
                              type="url"
                              placeholder="Coller l'adresse URL de l'image (ex: https://...)"
                              value={urlInput}
                              onChange={(e) => setUrlInput(e.target.value)}
                              className="flex-grow px-3 py-2 text-sm bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleAddImageUrl}
                              className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
                            >
                              Ajouter
                            </button>
                          </div>
                        )}

                        {/* Multi-upload Dropzone */}
                        <div className="relative">
                          <label className={`cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-3xl transition-all ${
                            isUploadingImages 
                              ? 'bg-blue-50 border-blue-400 opacity-80' 
                              : 'bg-white hover:bg-blue-50/50 border-gray-300 hover:border-blue-500 shadow-sm'
                          }`}>
                            {isUploadingImages ? (
                              <div className="flex flex-col items-center gap-3 text-blue-600 py-4">
                                <Loader2 size={36} className="animate-spin" />
                                <span className="text-sm font-bold">Optimisation et compression des images en cours...</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-center py-3">
                                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-1">
                                  <ImagePlus size={28} />
                                </div>
                                <span className="text-sm font-bold text-gray-900">
                                  Cliquez pour sélectionner plusieurs photos (ou glissez-déposez)
                                </span>
                                <span className="text-xs text-gray-500">
                                  Sélection multiple autorisée (JPEG, PNG, WebP) • Compression automatique instantanée
                                </span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={isUploadingImages}
                              className="hidden"
                              onChange={handleMultipleImagesChange}
                            />
                          </label>
                        </div>

                        {/* Main Cover Preview */}
                        {imagePreview && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                              <span className="flex items-center gap-1.5 text-blue-700">
                                <Star size={14} className="fill-amber-400 text-amber-500" /> Photo de Couverture Actuelle
                              </span>
                              <span className="text-gray-400">Cette image s'affiche en premier sur le site</span>
                            </div>
                            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/5 border-2 border-blue-600 shadow-sm">
                              <img
                                src={imagePreview}
                                alt="Couverture"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow">
                                <Star size={12} className="fill-white" /> Photo Principale
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Grid of uploaded images with controls */}
                        {currentGalleryImages.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                              <span>Toutes les photos du bien ({currentGalleryImages.length}) :</span>
                              <span className="text-gray-400 font-normal">Cliquez sur l'étoile pour définir la couverture</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-1">
                              {currentGalleryImages.map((imgUrl, idx) => {
                                const isCover = imgUrl === (formData.image || currentGalleryImages[0]);
                                return (
                                  <div
                                    key={idx}
                                    className={`relative group rounded-2xl overflow-hidden aspect-[4/3] bg-gray-100 border-2 transition-all ${
                                      isCover ? 'border-blue-600 ring-2 ring-blue-600/30' : 'border-transparent hover:border-gray-300'
                                    }`}
                                  >
                                    <img
                                      src={imgUrl}
                                      alt={`Photo ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />

                                    {/* Cover Badge */}
                                    {isCover && (
                                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
                                        <Star size={10} className="fill-white" /> Principale
                                      </div>
                                    )}

                                    {/* Number Badge */}
                                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                                      #{idx + 1}
                                    </div>

                                    {/* Overlay Actions */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                                      {!isCover && (
                                        <button
                                          type="button"
                                          onClick={() => setAsCoverImage(imgUrl)}
                                          className="p-1.5 bg-amber-400 text-gray-900 rounded-lg hover:bg-amber-300 transition-colors shadow"
                                          title="Définir comme photo principale"
                                        >
                                          <Star size={14} className="fill-gray-900" />
                                        </button>
                                      )}
                                      {idx > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => moveImage(idx, 'left')}
                                          className="p-1.5 bg-white text-gray-800 rounded-lg hover:bg-gray-100 transition-colors shadow"
                                          title="Déplacer vers la gauche"
                                        >
                                          <ArrowLeft size={14} />
                                        </button>
                                      )}
                                      {idx < currentGalleryImages.length - 1 && (
                                        <button
                                          type="button"
                                          onClick={() => moveImage(idx, 'right')}
                                          className="p-1.5 bg-white text-gray-800 rounded-lg hover:bg-gray-100 transition-colors shadow"
                                          title="Déplacer vers la droite"
                                        >
                                          <ArrowRight size={14} />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow"
                                        title="Supprimer cette photo"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-gray-100">
                      <button
                        type="submit"
                        disabled={isUploadingImages}
                        className="flex-grow bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 text-base"
                      >
                        {editingProperty ? 'Enregistrer les modifications' : 'Publier le Bien avec sa Galerie'}
                      </button>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="px-8 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all text-base"
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminProperties;
