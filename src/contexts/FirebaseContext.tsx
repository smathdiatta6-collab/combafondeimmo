import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
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
        let userDoc = await getDoc(userDocRef);
        
        // If the document doesn't exist yet but user is authenticated, check if we can restore/create it
        if (!userDoc.exists()) {
          const cleanedEmail = (currentUser.email || '').trim().toLowerCase();
          const savedStr = localStorage.getItem('simulated_admin_user');
          const saved = savedStr ? JSON.parse(savedStr) : null;
          const emailToUse = cleanedEmail || (saved ? saved.email : '');
          
          if (emailToUse) {
            const isEmailAdmin = emailToUse === "smathdiatta6@gmail.com" || emailToUse === "elhadjisillyndiaye@icloud.com";
            const newProfile = {
              email: emailToUse,
              role: isEmailAdmin ? 'admin' : 'user',
              displayName: currentUser.displayName || (saved ? saved.displayName : ''),
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newProfile);
            userDoc = await getDoc(userDocRef);
          }
        }

        if (userDoc.exists()) {
          const profileData = userDoc.data();
          const cleanedEmail = (profileData.email || '').trim().toLowerCase();
          const isEmailAdmin = cleanedEmail === "smathdiatta6@gmail.com" || cleanedEmail === "elhadjisillyndiaye@icloud.com";
          
          if (isEmailAdmin && profileData.role !== 'admin') {
            const updatedProfile = { ...profileData, role: 'admin' };
            await setDoc(userDocRef, updatedProfile, { merge: true });
            setUserProfile(updatedProfile);
          } else {
            setUserProfile(profileData);
          }
        }
      } else {
        // If there's no Firebase user, but we have a simulated user, try to sign them in anonymously!
        const savedStr = localStorage.getItem('simulated_admin_user');
        if (savedStr) {
          try {
            const saved = JSON.parse(savedStr);
            console.log("Restoring admin session via anonymous login...", saved.email);
            const userCredential = await signInAnonymously(auth);
            const userDocRef = doc(db, 'users', userCredential.user.uid);
            const profileData = {
              email: saved.email,
              role: 'admin',
              displayName: saved.displayName,
              createdAt: saved.createdAt || new Date().toISOString()
            };
            await setDoc(userDocRef, profileData);
            setUserProfile(profileData);
          } catch (err) {
            console.error("Failed to restore anonymous admin session", err);
            setUserProfile(null);
          }
        } else {
          setUserProfile(null);
        }
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

    try {
      setLoading(true);
      // Authenticate with Firebase Anonymously so Firestore calls have valid authentication claims
      const userCredential = await signInAnonymously(auth);
      const uid = userCredential.user.uid;

      const displayName = cleanedEmail === "smathdiatta6@gmail.com" ? "Smath Diatta" : "Elhadji Silly Ndiaye";
      const simUser = {
        uid: uid,
        email: cleanedEmail,
        displayName: displayName,
        createdAt: new Date().toISOString(),
        isSimulated: true
      };

      // Create the Admin Profile document in Firestore under this anonymous UID
      const profileData = {
        email: cleanedEmail,
        role: 'admin',
        displayName: displayName,
        createdAt: simUser.createdAt
      };
      
      await setDoc(doc(db, 'users', uid), profileData);
      localStorage.setItem('simulated_admin_user', JSON.stringify(simUser));
      setSimulatedUser(simUser);
      setUserProfile(profileData);
      setAuthError(null);
      setLoading(false);
      return true;
    } catch (error: any) {
      console.error("Passcode login failed with firebase auth", error);
      setAuthError("Erreur de connexion sécurisée Firebase. Veuillez réessayer.");
      setLoading(false);
      return false;
    }
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

  const activeProfile = userProfile || (simulatedUser ? {
    email: simulatedUser.email,
    role: 'admin',
    displayName: simulatedUser.displayName,
    createdAt: simulatedUser.createdAt
  } : null);

  const activeUser = user ? {
    ...user,
    email: user.email || activeProfile?.email || simulatedUser?.email,
    displayName: user.displayName || activeProfile?.displayName || simulatedUser?.displayName
  } : simulatedUser;

  const isAdmin = activeProfile?.role === 'admin' || 
                  activeUser?.email?.toLowerCase() === "smathdiatta6@gmail.com" || 
                  activeUser?.email?.toLowerCase() === "elhadjisillyndiaye@icloud.com";
                  
  const isSuperAdmin = activeUser?.email?.toLowerCase() === "smathdiatta6@gmail.com";

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
