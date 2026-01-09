<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // 1️⃣ Récupérer le token CAPTCHA
    $captcha = $_POST['g-recaptcha-response'] ?? '';

    if (empty($captcha)) {
        die("Veuillez cocher le captcha !");
    }

    // 2️⃣ Vérification auprès de Google
    $secretKey = 'TA_SECRET_KEY_V2';
    $response = file_get_contents(
        "https://www.google.com/recaptcha/api/siteverify?secret={$secretKey}&response={$captcha}"
    );
    $result = json_decode($response, true);

    // 3️⃣ Vérification du succès
    if (!$result['success']) {
        die("Captcha invalide. Veuillez réessayer.");
    }

    $username = $_POST['loginUsername'];
    $password = $_POST['loginPassword'];


    // Ici, vérifie ton login avec la base de données
    // Exemple simple :
    if ($username === 'admin' && $password === 'motdepasse') {
        echo "Connexion réussie !";
    } else {
        echo "Nom d'utilisateur ou mot de passe incorrect.";
    }
}
?>
