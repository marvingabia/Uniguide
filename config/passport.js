import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/index.js';

passport.use(new GoogleStrategy(
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

      // Find existing user by googleId or email
      let user = await User.findOne({ where: { googleId } });

      if (!user) {
        // Check if email already registered (local account)
        user = await User.findOne({ where: { email } });

        if (user) {
          // Link Google to existing local account
          await user.update({ googleId, avatar, authMethod: 'google' });
        } else {
          // Create new student account via Google
          user = await User.create({
            firstName,
            lastName,
            email,
            googleId,
            avatar,
            authMethod: 'google',
            role: 'student',
            password: null
          });
        }
      } else {
        // Update avatar in case it changed
        await user.update({ avatar });
      }

      // Only students can use Google Sign-In
      // Guidance and Cashier must use local credentials
      if (user.role !== 'student') {
        return done(null, false, {
          message: 'Staff accounts must sign in with email and password.'
        });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// Serialize / Deserialize (not used for sessions since we use express-session manually)
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
