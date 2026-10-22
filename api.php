<?php
/**
 * Omnia Engagement Wishes - Direct JSON Storage API
 * Handles Reading, Writing, and Deleting wishes directly in wishes.json
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dataFile = __DIR__ . '/wishes.json';

// Create wishes.json if it doesn't exist
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, '[]');
}

$method = $_SERVER['REQUEST_METHOD'];

// 1. GET: Return all stored wishes from wishes.json
if ($method === 'GET') {
    $content = file_get_contents($dataFile);
    if (!$content || trim($content) === '') {
        $content = '[]';
    }
    echo $content;
    exit;
}

// 2. POST: Add a new wish OR Delete a wish
if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'بيانات غير صالحة']);
        exit;
    }

    $rawContent = file_get_contents($dataFile);
    $wishes = json_decode($rawContent, true);
    if (!is_array($wishes)) {
        $wishes = [];
    }

    // A) Delete Action (from secret admin mode)
    if (isset($input['action']) && $input['action'] === 'delete' && isset($input['id'])) {
        $targetId = (string)$input['id'];
        $wishes = array_values(array_filter($wishes, function ($w) use ($targetId) {
            return (string)$w['id'] !== $targetId;
        }));

        file_put_contents($dataFile, json_encode($wishes, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'list' => $wishes]);
        exit;
    }

    // B) Add New Wish
    if (!empty($input['name']) && !empty($input['message'])) {
        $newWish = [
            'id' => isset($input['id']) ? (string)$input['id'] : ('msg_' . time() . '_' . rand(100, 999)),
            'name' => htmlspecialchars(trim($input['name']), ENT_QUOTES, 'UTF-8'),
            'message' => htmlspecialchars(trim($input['message']), ENT_QUOTES, 'UTF-8'),
            'time' => isset($input['time']) ? $input['time'] : date('d/m/Y h:i A')
        ];

        // Put newest at the top
        array_unshift($wishes, $newWish);

        file_put_contents($dataFile, json_encode($wishes, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'item' => $newWish, 'list' => $wishes]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'حقول ناقصة']);
    exit;
}
