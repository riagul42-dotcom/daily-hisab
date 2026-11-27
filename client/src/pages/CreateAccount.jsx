import { useState } from 'react';
import AddUserForm from '../components/AddUserForm.jsx';
import { useAuth } from '../auth.jsx';

export default function CreateAccount() {
  const { user } = useAuth();
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState('');

  const canAssignRoles = user?.role === 'superadmin';

  return (
    <div className="page">
      {notice && <div className="alert success">{notice}</div>}

      <div className="page-row">
        <div>
          <h2 className="welcome">নতুন আইডি খুলুন</h2>
          <p className="muted">
            {canAssignRoles
              ? 'যেকোনো ভূমিকার অ্যাকাউন্ট তৈরি করতে পারবেন।'
              : 'আপনি পারিবারিক ব্যবহারকারী বা কর্মচারী অ্যাকাউন্ট তৈরি করতে পারবেন।'}
          </p>
        </div>
      </div>

      <div className="card">
        <AddUserForm
          key={formKey}
          canAssignRoles={canAssignRoles}
          onCancel={() => setFormKey((k) => k + 1)}
          onSaved={() => {
            setNotice('নতুন আইডি তৈরি হয়েছে — ব্যবহারকারী এখন লগইন করতে পারবে।');
            setFormKey((k) => k + 1);
          }}
        />
      </div>
    </div>
  );
}
