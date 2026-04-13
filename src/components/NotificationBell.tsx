import React, { useState, useEffect } from 'react';
import { Bell, X, MessageSquare, CreditCard, FileText, Info } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Notification } from '../services/NotificationService';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useFirebase } from '../contexts/FirebaseContext';
import { handleFirestoreError, OperationType } from '../firebase';

const NotificationBell: React.FC = () => {
  const { isAdmin } = useFirebase();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    }, (error) => {
      // Only log if it's not a permission error during logout/login transition
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare size={16} className="text-blue-500" />;
      case 'payment': return <CreditCard size={16} className="text-green-500" />;
      case 'contract': return <FileText size={16} className="text-purple-500" />;
      default: return <Info size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-blue-700 transition-colors bg-gray-50 rounded-xl"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-900">Notifications</h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <Bell size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Aucune notification</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className={`p-4 hover:bg-gray-50 transition-colors relative group ${!notif.read ? 'bg-blue-50/30' : ''}`}
                      >
                        <div className="flex gap-3">
                          <div className="mt-1 shrink-0">
                            {getIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{notif.title}</p>
                            <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{notif.message}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] text-gray-400">
                                {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {notif.link && (
                                <Link 
                                  to={notif.link}
                                  onClick={() => {
                                    setIsOpen(false);
                                    if (notif.id) markAsRead(notif.id);
                                  }}
                                  className="text-[10px] font-bold text-blue-600 hover:underline"
                                >
                                  Voir
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                        {!notif.read && (
                          <button
                            onClick={() => notif.id && markAsRead(notif.id)}
                            className="absolute top-4 right-4 w-2 h-2 bg-blue-600 rounded-full"
                            title="Marquer comme lu"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {notifications.length > 0 && (
                <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
                  <button 
                    onClick={() => {
                      notifications.forEach(n => !n.read && n.id && markAsRead(n.id));
                    }}
                    className="text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    Tout marquer comme lu
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
