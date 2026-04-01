import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { USER_ROLE_LABELS } from '@/entities';
import type { User, UserRole } from '@/entities';
import styles from './Auth.module.css';

export function ProfilePage() {
  const navigate = useNavigate();
  const { currentUser, updateProfile, changePassword, logout, updateUserRole, getAllUsers } =
    useAuthStore();

  const [firstName, setFirstName] = useState(currentUser?.firstName ?? '');
  const [lastName, setLastName] = useState(currentUser?.lastName ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [department, setDepartment] = useState(currentUser?.department ?? '');
  const [profileSaved, setProfileSaved] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      getAllUsers().then(setUsers);
    }
  }, [isAdmin, getAllUsers]);

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  const initials =
    (currentUser.firstName[0] ?? '') + (currentUser.lastName[0] ?? '');

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await updateProfile({ firstName, lastName, phone, department });
    if (ok) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess(false);

    if (newPassword !== confirmNew) {
      setPwdError('Пароли не совпадают');
      return;
    }

    const ok = await changePassword(oldPassword, newPassword);
    if (ok) {
      setPwdSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmNew('');
      setTimeout(() => setPwdSuccess(false), 2000);
    } else {
      setPwdError(useAuthStore.getState().error ?? 'Ошибка смены пароля');
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    await updateUserRole(userId, role);
    const updated = await getAllUsers();
    setUsers(updated);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.profilePage}>
      <div className={styles.profileHeader}>
        <div className={styles.avatar}>{initials.toUpperCase()}</div>
        <div>
          <div className={styles.profileName}>
            {currentUser.firstName} {currentUser.lastName}
          </div>
          <div className={styles.profileRole}>
            {USER_ROLE_LABELS[currentUser.role]}
          </div>
          <div className={styles.profileEmail}>{currentUser.email}</div>
        </div>
      </div>

      {/* Profile edit */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Личные данные</h2>
        <form className={styles.profileForm} onSubmit={handleProfileSave}>
          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.label}>Имя</label>
              <input
                className={styles.input}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Фамилия</label>
              <input
                className={styles.input}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Телефон</label>
            <input
              className={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 900 000-00-00"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Отдел</label>
            <input
              className={styles.input}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="HR / Разработка / ..."
            />
          </div>
          {profileSaved && <div className={styles.success}>Данные сохранены</div>}
          <div className={styles.actions}>
            <Button type="submit">Сохранить</Button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Смена пароля</h2>
        <form className={styles.profileForm} onSubmit={handlePasswordChange}>
          <div className={styles.field}>
            <label className={styles.label}>Текущий пароль</label>
            <input
              className={styles.input}
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Новый пароль</label>
            <input
              className={styles.input}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Подтверждение</label>
            <input
              className={styles.input}
              type="password"
              value={confirmNew}
              onChange={(e) => setConfirmNew(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {pwdError && <div className={styles.error}>{pwdError}</div>}
          {pwdSuccess && <div className={styles.success}>Пароль изменён</div>}
          <div className={styles.actions}>
            <Button type="submit">Изменить пароль</Button>
          </div>
        </form>
      </div>

      {/* Admin: user management */}
      {isAdmin && users.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Управление пользователями</h2>
          <table className={styles.usersTable}>
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.firstName} {u.lastName}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    {u.id === currentUser.id ? (
                      USER_ROLE_LABELS[u.role]
                    ) : (
                      <select
                        className={styles.roleSelect}
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(u.id, e.target.value as UserRole)
                        }
                      >
                        {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((r) => (
                          <option key={r} value={r}>
                            {USER_ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Logout */}
      <div className={styles.section}>
        <div className={styles.dangerZone}>
          <div className={styles.dangerTitle}>Выход</div>
          <Button variant="secondary" onClick={handleLogout}>
            Выйти из аккаунта
          </Button>
        </div>
      </div>
    </div>
  );
}
