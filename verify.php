<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $secret = '6Lcvq0UsAAAAAMPYkj7CSaMhxo80zQRCNvHHhvr8';
    $response = $_POST['g-recaptcha-response'];
    
    $verify = file_get_contents("https://www.google.com/recaptcha/api/siteverify?secret={$secret}&response={$response}");
    $captcha_success = json_decode($verify);

    if ($captcha_success->success) {
        echo "Captcha validé ! Formulaire envoyé.";
        // ici tu peux traiter le formulaire
    } else {
        echo "Veuillez valider le captcha !";
    }
}
?>
