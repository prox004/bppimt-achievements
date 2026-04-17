"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
    user: User | null;
    role: 'student' | 'admin' | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true, signOut: async () => { } });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<'student' | 'admin' | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Enforce domain check
                if (!firebaseUser.email?.endsWith('@bppimt.ac.in')) {
                    await firebaseSignOut(auth);
                    setUser(null);
                    setRole(null);
                    setLoading(false);
                    return;
                }

                try {
                    const userDocRef = doc(db, 'users', firebaseUser.uid);
                    const userDoc = await getDoc(userDocRef);

                    let userRole: 'student' | 'admin' = 'student';

                    if (userDoc.exists()) {
                        userRole = userDoc.data().role || 'student';
                    } else {
                        // Create user doc if not exists
                        await setDoc(userDocRef, {
                            email: firebaseUser.email,
                            role: 'student',
                            createdAt: new Date().toISOString()
                        });
                    }

                    setUser(firebaseUser);
                    setRole(userRole);
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    setUser(firebaseUser);
                    setRole('student'); // Fallback
                }
            } else {
                setUser(null);
                setRole(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const signOut = async () => {
        await firebaseSignOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, role, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
