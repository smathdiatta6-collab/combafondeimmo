import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface FirebaseContextType {
  user: any | null;
  userProfile: any | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  login: () => Promise<void>;
  loginWithPasscode: (email: string, passcode: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [simulatedUser, setSimulatedUser] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('simulated_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
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

  const loginWithPasscode = async (email: string, passcode: string): Promise<boolean> => {
    setAuthError(null);
    const cleanedEmail = email.trim().toLowerCase();
    const allowedEmails = ["smathdiatta6@gmail.com", "elhadjisillyndiaye@icloud.com"];
    
    if (!allowedEmails.includes(cleanedEmail)) {
      setAuthError("Cette adresse email n'est pas autorisée à se connecter.");
      return false;
    }

    const validPasscodes = ["coumba2026", "coumbafonde", "2026", "immo2026", "elhadji2026"];
    if (!validPasscodes.includes(passcode.trim().toLowerCase())) {
      setAuthError("Code d'accès incorrect. Veuillez réessayer.");
      return false;
    }

    const displayName = cleanedEmail === "smathdiatta6@gmail.com" ? "Smath Diatta" : "Elhadji Silly Ndiaye";
    const simUser = {
      uid: "simulated_" + (cleanedEmail === "smathdiatta6@gmail.com" ? "smath" : "elhadji"),
      email: cleanedEmail,
      displayName: displayName,
      createdAt: new Date().toISOString(),
      isSimulated: true
    };

    localStorage.setItem('simulated_admin_user', JSON.stringify(simUser));
    setSimulatedUser(simUser);
    setAuthError(null);
    return true;
  };

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('simulated_admin_user');
      setSimulatedUser(null);
      setAuthError(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const activeUser = user || simulatedUser;
  const activeProfile = userProfile || (simulatedUser ? {
    email: simulatedUser.email,
    role: 'admin',
    displayName: simulatedUser.displayName,
    createdAt: simulatedUser.createdAt
  } : null);

  const isAdmin = activeProfile?.role === 'admin' || 
                  activeUser?.email === "smathdiatta6@gmail.com" || 
                  activeUser?.email === "Elhadjisillyndiaye@icloud.com" ||
                  activeUser?.email === "elhadjisillyndiaye@icloud.com";
                  
  const isSuperAdmin = activeUser?.email === "smathdiatta6@gmail.com";

  return (
    <FirebaseContext.Provider value={{ 
      user: activeUser, 
      userProfile: activeProfile, 
      loading, 
      isAdmin, 
      isSuperAdmin, 
      authError, 
      setAuthError, 
      login, 
      loginWithPasscode,
      logout 
    }}>
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
