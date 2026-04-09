import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Mail, Trash2, CheckCircle, Clock, User, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
  status: 'unread' | 'read';
}

const AdminMessages: React.FC = () => {
  const { user, isAdmin, loading } = useFirebase();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactMessage));
      setMessages(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'contacts');
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'contacts', id), { status: 'read' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `contacts/${id}`);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try {
      await deleteDoc(doc(db, 'contacts', id));
      if (selectedMessage?.id === id) setSelectedMessage(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `contacts/${id}`);
    }
  };

  if (loading) return <div className="pt-32 text-center">Chargement...</div>;
  if (!user || !isAdmin) return <div className="pt-32 text-center">Accès refusé.</div>;

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Messages de Contact</h1>
          <p className="text-gray-600">Gérez les demandes reçues via le formulaire de contact.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Messages List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700 flex items-center gap-2">
                <Mail size={18} /> Boîte de réception
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 italic">Aucun message</div>
                ) : (
                  messages.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => {
                        setSelectedMessage(msg);
                        if (msg.status === 'unread') markAsRead(msg.id);
                      }}
                      className={`w-full text-left p-4 border-b border-gray-50 hover:bg-blue-50 transition-colors relative ${
                        selectedMessage?.id === msg.id ? 'bg-blue-50' : ''
                      } ${msg.status === 'unread' ? 'font-bold' : ''}`}
                    >
                      {msg.status === 'unread' && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-600 rounded-full" />
                      )}
                      <div className="flex justify-between items-start mb-1 ml-2">
                        <span className="text-sm text-gray-900 truncate pr-2">{msg.name}</span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate ml-2">{msg.subject}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {selectedMessage ? (
                <motion.div
                  key={selectedMessage.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 h-full min-h-[500px] flex flex-col"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedMessage.subject}</h2>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <User size={16} className="text-blue-600" />
                          {selectedMessage.name}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail size={16} className="text-blue-600" />
                          {selectedMessage.email}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={16} className="text-blue-600" />
                          {new Date(selectedMessage.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMessage(selectedMessage.id)}
                      className="p-3 text-red-600 hover:bg-red-50 rounded-2xl transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="flex-grow bg-gray-50 rounded-3xl p-8 text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {selectedMessage.message}
                  </div>

                  <div className="mt-8 pt-8 border-t border-gray-100 flex gap-4">
                    <a
                      href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`}
                      className="flex-1 bg-blue-900 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
                    >
                      <Mail size={20} />
                      Répondre par Email
                    </a>
                    <button
                      onClick={() => setSelectedMessage(null)}
                      className="px-8 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                    >
                      Fermer
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 h-full min-h-[500px] flex flex-col items-center justify-center text-gray-400">
                  <MessageSquare size={64} className="mb-4 opacity-20" />
                  <p className="text-lg">Sélectionnez un message pour le lire</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMessages;
