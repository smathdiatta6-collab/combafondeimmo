import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, MessageCircle } from 'lucide-react';
import React, { useState } from 'react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await addDoc(collection(db, 'contacts'), {
        ...formData,
        createdAt: new Date().toISOString(),
        status: 'unread'
      });
      alert('Merci ! Votre message a été envoyé.');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'contacts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendWhatsApp = () => {
    const phone = "221775519683";
    const text = `Nom: ${formData.name}%0AEmail: ${formData.email}%0AMessage: ${formData.message}`;
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  return (
    <div className="pt-32 pb-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Info */}
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-5xl font-bold text-blue-900 mb-8"
            >
              Parlons de votre <br />
              <span className="text-blue-600">futur chez-vous</span>
            </motion.h1>
            <p className="text-gray-600 text-xl mb-12 leading-relaxed">
              Notre équipe est à votre disposition pour répondre à toutes vos questions et vous accompagner dans vos démarches.
            </p>

            <div className="space-y-8">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600 flex-shrink-0">
                  <Phone size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-1">Téléphone</h4>
                  <p className="text-gray-600">+221 77 551 96 83</p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600 flex-shrink-0">
                  <Mail size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-1">Email</h4>
                  <p className="text-gray-600">contact@coumbafonde-immo.com</p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600 flex-shrink-0">
                  <MapPin size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-1">Adresse</h4>
                  <p className="text-gray-600">Dakar, Sénégal</p>
                </div>
              </div>
            </div>

            <div className="mt-12 p-8 bg-blue-900 rounded-3xl text-white">
              <h4 className="text-xl font-bold mb-4">Suivez-nous</h4>
              <div className="flex gap-4">
                {['Facebook', 'Instagram', 'LinkedIn'].map(social => (
                  <a key={social} href="#" className="px-4 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all text-sm font-medium">
                    {social}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-10 rounded-[3rem] shadow-xl shadow-blue-900/5 border border-gray-100"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Jean Dupont"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Email</label>
                  <input
                    type="email"
                    required
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="jean@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Sujet</label>
                <input
                  type="text"
                  required
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Demande d'information"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Message</label>
                <textarea
                  required
                  rows={5}
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  placeholder="Comment pouvons-nous vous aider ?"
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 disabled:opacity-50"
                >
                  <Send size={20} />
                  {isSubmitting ? 'Envoi...' : 'Envoyer'}
                </button>
                <button
                  type="button"
                  onClick={sendWhatsApp}
                  className="flex-1 bg-[#25D366] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#1ebe5d] transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/10"
                >
                  <MessageCircle size={20} />
                  WhatsApp
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
