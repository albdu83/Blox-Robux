export default async function handler(req, res) {
  try {
    // Exemple : on renvoie une réponse simple
    res.status(200).json({
      success: true,
      message: "TimeWall endpoint connected successfully!"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.toString()
    });
  }
}
