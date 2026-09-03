export const requireLogin = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  if (!roles.includes(req.session.user.role)) return res.status(403).render('403', { title: 'Access Denied' });
  next();
};
