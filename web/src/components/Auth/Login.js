import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState('password');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  
  const { signIn, signInWithOTP, verifyOTP, session } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  React.useEffect(() => {
    if (session) {
      navigate('/dashboard');
    }
  }, [session, navigate]);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      await signIn({ email, password });
      navigate('/dashboard');
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await signInWithOTP({ email });
      setOtpSent(true);
      alert('Check your email for the login code');
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode) return;

    setLoading(true);
    try {
      await verifyOTP({ email, token: otpCode, type: 'magiclink' });
      navigate('/dashboard');
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-logo">VERIDIAN</h1>
          <p className="auth-tagline">Verify. Report. Respond.</p>
        </div>

        <div className="method-toggle">
          <button
            className={`method-btn ${loginMethod === 'password' ? 'active' : ''}`}
            onClick={() => setLoginMethod('password')}
          >
            Password
          </button>
          <button
            className={`method-btn ${loginMethod === 'otp' ? 'active' : ''}`}
            onClick={() => setLoginMethod('otp')}
          >
            Magic Link
          </button>
        </div>

        <form className="auth-form" onSubmit={loginMethod === 'password' ? handlePasswordLogin : (otpSent ? handleVerifyOTP : handleSendOTP)}>
          <div className="form-group">
            <label>EMAIL</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {loginMethod === 'password' ? (
            <>
              <div className="form-group">
                <label>PASSWORD</label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? 'LOADING...' : 'LOGIN'}
              </button>

              <Link to="/forgot-password" className="forgot-link">
                Forgot password?
              </Link>
            </>
          ) : (
            <>
              {otpSent ? (
                <>
                  <div className="form-group">
                    <label>ENTER CODE</label>
                    <input
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      maxLength={6}
                      required
                    />
                  </div>

                  <button type="submit" className="auth-button" disabled={loading}>
                    {loading ? 'VERIFYING...' : 'VERIFY'}
                  </button>

                  <button
                    type="button"
                    className="resend-btn"
                    onClick={handleSendOTP}
                    disabled={loading}
                  >
                    Resend code
                  </button>
                </>
              ) : (
                <button type="submit" className="auth-button" disabled={loading}>
                  {loading ? 'SENDING...' : 'SEND MAGIC LINK'}
                </button>
              )}
            </>
          )}

          <p className="auth-switch">
            Don't have an account? <Link to="/signup">SIGN UP</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
