export const requireLogin = (req, res, next) => {
  console.log('========================================');
  console.log('AUTH CHECK');
  console.log('Path:', req.originalUrl);
  console.log('Method:', req.method);
  console.log('Session ID:', req.sessionID);
  console.log('Has Session:', !!req.session);
  console.log('Has User:', !!req.session?.user);
  console.log('Session User:', req.session?.user || null);
  console.log('========================================');

  if (!req.session?.user) {
    console.log('AUTH FAILED — USER SESSION NOT FOUND');
    return res.redirect('/login');
  }

  next();
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    console.log('========================================');
    console.log('ROLE CHECK');
    console.log('Path:', req.originalUrl);
    console.log('Method:', req.method);
    console.log('Session ID:', req.sessionID);
    console.log('Has Session:', !!req.session);
    console.log('Session User:', req.session?.user || null);
    console.log('Allowed Roles:', roles);
    console.log('========================================');

    if (!req.session?.user) {
      console.log('SESSION LOST — REDIRECTING TO LOGIN');
      return res.redirect('/login');
    }

    if (!roles.includes(req.session.user.role)) {
      console.log('ACCESS DENIED — WRONG ROLE');
      console.log('Current Role:', req.session.user.role);
      console.log('Allowed Roles:', roles);

      return res.status(403).render('403', {
        title: 'Access Denied'
      });
    }

    console.log(
      'AUTHORIZED:',
      req.session.user.email,
      '| Role:',
      req.session.user.role
    );

    next();
  };
};