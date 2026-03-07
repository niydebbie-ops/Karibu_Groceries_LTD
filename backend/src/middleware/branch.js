module.exports = (allowedBranch) => {
  return (req, res, next) => {
    if (req.user.branch && req.user.branch !== allowedBranch) {
      return res.status(403).json({ message: "Forbidden: branch restriction" });
    }
    next();
  };
};
