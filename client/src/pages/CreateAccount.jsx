import { useState } from 'react';
import AddUserForm from '../components/AddUserForm.jsx';

export default function CreateAccount() {
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState('');

  return (
    <div className="page">
      {notice && <div className="alert success">{notice}</div>}

      <div className="page-row">
        <div>
          <h2 className="welcome">নতুন আইডি খুলুন</h2>
          <p className="muted">শুধু অ্যাডমিন নতুন আইডি তৈরি করতে পারেন।</p>
        </div>
      </div>

      <div className="card">
        <AddUserForm
          key={formKey}
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
