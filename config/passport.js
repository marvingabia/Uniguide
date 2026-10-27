import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { FirestoreAdapter } from '../models/firestore-adapter.js';

console.log('🔐 Initializing Passport strategies...');

// ALWAYS register a Google strategy
passport.use(
  'google',
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email      = profile.emails?.[0]?.value;
        const firstName  = profile.name?.givenName  || profile.displayName.split(' ')[0] || '';
        const lastName   = profile.name?.familyName || profile.displayName.split(' ').slice(1).join(' ') || '';
        const avatar     = profile.photos?.[0]?.value || null;
        const googleId   = profile.id;

        if (!email) return done(null, false, { message: 'No email returned from Google.' });

        // Find existing user by googleId
        let user = await FirestoreAdapter.findUserByGoogleId(googleId);

        if (!user) {
          // Check if email already registered (local account)
          user = await FirestoreAdapter.findUserByEmail(email);

          if (user) {
            // Link Google to existing local account
            await FirestoreAdapter.updateUser(user.id, { 
              googleId, 
              avatar, 
              authMethod: 'google' 
            });
          } else {
            // Create new student account via Google
            user = await FirestoreAdapter.createUser({
              firstName,
              lastName,
              email,
              googleId,
              avatar,
              authMethod: 'google',
              role: 'student',
              password: null,
              isApproved: true
            });
          }
        } else {
          // Update avatar in case it changed
          await FirestoreAdapter.updateUser(user.id, { avatar });
        }

        // Only students can use Google Sign-In
        if (user.role !== 'student') {
          return done(null, false, {
            message: 'Staff accounts must sign in with email and password.'
          });
        }

        return done(null, user);
      } catch (err) {
        console.error('❌ Google auth error:', err.message);
        return done(err);
      }
    }
  )
);

// Serialize / Deserialize with Firestore
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await FirestoreAdapter.findUserById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

console.log('✅ Passport strategies initialized');

export default passport;
