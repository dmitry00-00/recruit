import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/db';
import type { User, UserRole } from '@/entities';

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function hashPassword(password: string, salt?: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const s = salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: s, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  return `${toHex(s.buffer)}:${toHex(derived)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Support legacy unsalted SHA-256 hashes (no colon separator)
  if (!stored.includes(':')) {
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(password));
    const legacyHash = toHex(hashBuffer);
    return legacyHash === stored;
  }

  const [saltHex] = stored.split(':');
  const salt = fromHex(saltHex);
  const rehashed = await hashPassword(password, salt);
  return rehashed === stored;
}

interface AuthState {
  currentUser: Omit<User, 'passwordHash'> | null;
  loading: boolean;
  error: string | null;

  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
  }) => Promise<boolean>;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;

  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    department?: string;
    avatarUrl?: string;
  }) => Promise<boolean>;

  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  updateUserRole: (userId: string, role: UserRole) => Promise<boolean>;
  getAllUsers: () => Promise<User[]>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      loading: false,
      error: null,

      register: async ({ email, password, firstName, lastName, role }) => {
        set({ loading: true, error: null });
        try {
          const existing = await db.users.where('email').equals(email).first();
          if (existing) {
            set({ loading: false, error: 'Пользователь с таким email уже существует' });
            return false;
          }

          const userCount = await db.users.count();
          const assignedRole: UserRole = userCount === 0 ? 'admin' : (role ?? 'recruiter');

          const now = new Date();
          const passwordHash = await hashPassword(password);
          const id = crypto.randomUUID();

          const user: User = {
            id,
            email,
            passwordHash,
            firstName,
            lastName,
            role: assignedRole,
            createdAt: now,
            updatedAt: now,
          };

          await db.users.add(user);

          const { passwordHash: _, ...safeUser } = user;
          set({ currentUser: safeUser, loading: false, error: null });
          return true;
        } catch {
          set({ loading: false, error: 'Ошибка при регистрации' });
          return false;
        }
      },

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const user = await db.users.where('email').equals(email).first();
          if (!user) {
            set({ loading: false, error: 'Неверный email или пароль' });
            return false;
          }

          const valid = await verifyPassword(password, user.passwordHash);
          if (!valid) {
            set({ loading: false, error: 'Неверный email или пароль' });
            return false;
          }

          // Migrate legacy SHA-256 hash to PBKDF2 on successful login
          if (!user.passwordHash.includes(':')) {
            const upgraded = await hashPassword(password);
            await db.users.update(user.id, { passwordHash: upgraded });
          }

          const { passwordHash: _, ...safeUser } = user;
          set({ currentUser: safeUser, loading: false, error: null });
          return true;
        } catch {
          set({ loading: false, error: 'Ошибка при входе' });
          return false;
        }
      },

      logout: () => {
        set({ currentUser: null, error: null });
      },

      updateProfile: async (data) => {
        const { currentUser } = get();
        if (!currentUser) return false;

        try {
          const updates = { ...data, updatedAt: new Date() };
          await db.users.update(currentUser.id, updates);
          set({ currentUser: { ...currentUser, ...updates } });
          return true;
        } catch {
          return false;
        }
      },

      changePassword: async (oldPassword, newPassword) => {
        const { currentUser } = get();
        if (!currentUser) return false;

        try {
          const user = await db.users.get(currentUser.id);
          if (!user) return false;

          const valid = await verifyPassword(oldPassword, user.passwordHash);
          if (!valid) {
            set({ error: 'Неверный текущий пароль' });
            return false;
          }

          const newHash = await hashPassword(newPassword);
          await db.users.update(currentUser.id, {
            passwordHash: newHash,
            updatedAt: new Date(),
          });
          set({ error: null });
          return true;
        } catch {
          return false;
        }
      },

      updateUserRole: async (userId, role) => {
        const { currentUser } = get();
        if (!currentUser || currentUser.role !== 'admin') return false;

        try {
          await db.users.update(userId, { role, updatedAt: new Date() });
          return true;
        } catch {
          return false;
        }
      },

      getAllUsers: async () => {
        return db.users.toArray();
      },
    }),
    {
      name: 'recruit-auth',
      partialize: (state) => ({ currentUser: state.currentUser }),
    },
  ),
);
