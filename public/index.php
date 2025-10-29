<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);


require_once '../vendor/autoload.php';

$loader = new \Twig\Loader\FilesystemLoader('../templates');
$twig = new \Twig\Environment($loader);

// Simple routing system
$page = $_GET['page'] ?? 'home';

switch ($page) {
  case 'auth/login':
    echo $twig->render('auth/login.twig');
    break;

  case 'auth/signup':
    echo $twig->render('auth/signup.twig');
    break;

  case 'dashboard':
    echo $twig->render('dashboard.twig');
    break;

  case 'tickets':
    echo $twig->render('tickets.twig');
    break;

  default:
    echo $twig->render('landing.twig');
    break;
}
