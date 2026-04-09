import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, getDocs } from 'firebase/firestore';
import { Property } from '../types';
import { PROPERTIES } from '../data';
import { Plus, Pencil, Trash2, X, Upload, Home, MapPin, Tag, Info, Bed, Bath, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';

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
    bedrooms: 0,
    bathrooms: 0
  });
  const [featureInput, setFeatureInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const q = query(collection(db, 'properties'), orderBy('title'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setProperties(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'properties');
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) { // Limit to ~800KB for base64 storage in Firestore
        alert("L'image est trop volumineuse. Veuillez choisir une image de moins de 800 Ko.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagePreview(base64String);
        setFormData({ ...formData, image: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;

    try {
      const dataToSave = {
        ...formData,
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
    if (!isSuperAdmin || !window.confirm('Voulez-vous vraiment supprimer ce bien ?')) return;
    try {
      await deleteDoc(doc(db, 'properties', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `properties/${id}`);
    }
  };

  const openModal = (property?: Property) => {
    if (property) {
      setEditingProperty(property);
      setFormData(property);
      setImagePreview(property.image);
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
        bedrooms: 0,
        bathrooms: 0
      });
      setImagePreview(null);
    }
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
    if (!isSuperAdmin || isMigrating) return;
    if (!window.confirm('Voulez-vous importer les biens initiaux du site dans la base de données ? Cela vous permettra de les modifier.')) return;

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
  if (!user || !isSuperAdmin) return <div className="pt-32 text-center">Accès refusé.</div>;

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Gestion des Biens</h1>
            <p className="text-gray-600">Ajoutez, modifiez ou supprimez des appartements, villas et terrains.</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={migrateData}
              disabled={isMigrating}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50"
            >
              <Database size={20} />
              {isMigrating ? 'Importation...' : 'Importer Biens Initiaux'}
            </button>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg"
            >
              <Plus size={20} />
              Ajouter un Bien
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties.map((property) => (
            <div key={property.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 group">
              <div className="relative aspect-video overflow-hidden">
                <img src={property.image} alt={property.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => openModal(property)}
                    className="p-2 bg-white/90 backdrop-blur-sm text-blue-600 rounded-xl hover:bg-white transition-colors shadow-sm"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(property.id)}
                    className="p-2 bg-white/90 backdrop-blur-sm text-red-600 rounded-xl hover:bg-white transition-colors shadow-sm"
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
                <div className="text-green-600 font-bold text-lg">
                  {property.price.toLocaleString()} FCFA
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[2.5rem] w-full max-w-4xl max-height-[90vh] overflow-y-auto shadow-2xl"
              >
                <div className="p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900">
                      {editingProperty ? 'Modifier le Bien' : 'Nouveau Bien'}
                    </h2>
                    <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                      <X size={24} />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Left Column */}
                      <div className="space-y-6">
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
                      </div>

                      {/* Right Column */}
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Upload size={16} /> Photo du Bien
                          </label>
                          <div className="relative aspect-video bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden group">
                            {imagePreview ? (
                              <>
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <label className="cursor-pointer bg-white text-gray-900 px-4 py-2 rounded-xl font-bold text-sm shadow-lg">
                                    Changer la photo
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                  </label>
                                </div>
                              </>
                            ) : (
                              <label className="cursor-pointer flex flex-col items-center gap-2 text-gray-400 hover:text-blue-500 transition-colors">
                                <Upload size={32} />
                                <span className="text-sm font-medium">Cliquez pour ajouter une photo</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                              </label>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Info size={16} /> Description
                          </label>
                          <textarea
                            required
                            rows={4}
                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Décrivez les atouts du bien..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Caractéristiques</label>
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              className="flex-grow px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                              value={featureInput}
                              onChange={(e) => setFeatureInput(e.target.value)}
                              placeholder="Ex: Piscine, Garage..."
                              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                            />
                            <button
                              type="button"
                              onClick={addFeature}
                              className="bg-gray-900 text-white px-4 rounded-2xl hover:bg-gray-800 transition-colors"
                            >
                              Ajouter
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {formData.features?.map((feature, index) => (
                              <span
                                key={index}
                                className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1"
                              >
                                {feature}
                                <button type="button" onClick={() => removeFeature(index)} className="hover:text-blue-900">
                                  <X size={14} />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        type="submit"
                        className="flex-grow bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg"
                      >
                        {editingProperty ? 'Enregistrer les modifications' : 'Publier le Bien'}
                      </button>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="px-8 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
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
