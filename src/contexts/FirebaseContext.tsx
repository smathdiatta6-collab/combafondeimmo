import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface FirebaseContextType {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setAuthError(null);
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        } else {
          // Create a default profile if it doesn't exist
          const isEmailAdmin = currentUser.email === "smathdiatta6@gmail.com" || currentUser.email === "Elhadjisillyndiaye@icloud.com";
          const newProfile = {
            email: currentUser.email,
            role: isEmailAdmin ? 'admin' : 'user',
            displayName: currentUser.displayName,
            createdAt: new Date().toISOString()
          };
          await setDoc(userDocRef, newProfile);
          setUserProfile(newProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        setAuthError("Le pop-up de connexion a été bloqué par votre navigateur. Veuillez autoriser les pop-ups ou ouvrir l'application dans un nouvel onglet.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("La fenêtre de connexion a été fermée avant la fin de l'authentification.");
      } else {
        setAuthError("La connexion a échoué. Veuillez ouvrir l'application dans un nouvel onglet et réessayer.");
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setAuthError(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const isAdmin = userProfile?.role === 'admin' || 
                  user?.email === "smathdiatta6@gmail.com" || 
                  user?.email === "Elhadjisillyndiaye@icloud.com";
  const isSuperAdmin = user?.email === "smathdiatta6@gmail.com";

  return (
    <FirebaseContext.Provider value={{ user, userProfile, loading, isAdmin, isSuperAdmin, authError, setAuthError, login, logout }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
