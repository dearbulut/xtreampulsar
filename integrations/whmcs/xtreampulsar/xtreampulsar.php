<?php
/**
 * WHMCS Provisioning Module for XtreamPulsar
 * ------------------------------------------------------------------
 * Install: copy this folder to  <whmcs>/modules/servers/xtreampulsar/
 * Then in WHMCS: Setup > Products/Services > Servers > Add New Server
 *   - Hostname:   https://panel.yourdomain.com   (your XtreamPulsar panel URL)
 *   - Access Hash: <your reseller API key>        (from Reseller Panel > API & WHMCS)
 * Create a Product using module "xtreampulsar" and set Config Option 1 to a Package ID
 * (or leave empty and set duration/connections below).
 *
 * API base used:  {hostname}/api/v1/reseller-api
 * Auth header:    X-API-Key: <access hash>
 */

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

function xtreampulsar_MetaData()
{
    return [
        'DisplayName' => 'XtreamPulsar IPTV',
        'APIVersion' => '1.1',
        'RequiresServer' => true,
    ];
}

function xtreampulsar_ConfigOptions()
{
    return [
        'Package ID' => [
            'Type' => 'text',
            'Size' => '30',
            'Description' => 'XtreamPulsar package ID (leave empty to use duration + connections below)',
        ],
        'Duration (days)' => [
            'Type' => 'text',
            'Size' => '6',
            'Default' => '30',
            'Description' => 'Used only when Package ID is empty',
        ],
        'Max Connections' => [
            'Type' => 'text',
            'Size' => '6',
            'Default' => '1',
            'Description' => 'Used only when Package ID is empty',
        ],
    ];
}

function xtreampulsar_api($params, $method, $path, $body = null)
{
    $base = rtrim($params['serverhostname'], '/');
    if (strpos($base, 'http') !== 0) {
        $base = ($params['serversecure'] ? 'https://' : 'http://') . $base;
    }
    $url = $base . '/api/v1/reseller-api' . $path;
    $key = $params['serveraccesshash'] ?: $params['serverpassword'];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-API-Key: ' . $key,
        ],
        CURLOPT_TIMEOUT => 30,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err) {
        return ['ok' => false, 'error' => $err];
    }
    $json = json_decode($resp, true);
    if ($code >= 200 && $code < 300) {
        return ['ok' => true, 'data' => $json['data'] ?? $json];
    }
    $msg = is_array($json) && isset($json['message'])
        ? (is_array($json['message']) ? implode(', ', $json['message']) : $json['message'])
        : ('HTTP ' . $code);
    return ['ok' => false, 'error' => $msg];
}

function xtreampulsar_CreateAccount(array $params)
{
    try {
        $body = [
            'username' => $params['username'],
            'password' => $params['password'],
        ];
        $pkg = trim($params['configoption1']);
        if ($pkg !== '') {
            $body['packageId'] = $pkg;
        } else {
            $body['durationDays'] = (int) ($params['configoption2'] ?: 30);
            $body['maxConnections'] = (int) ($params['configoption3'] ?: 1);
        }
        $r = xtreampulsar_api($params, 'POST', '/users', $body);
        return $r['ok'] ? 'success' : $r['error'];
    } catch (\Throwable $e) {
        return $e->getMessage();
    }
}

function xtreampulsar_SuspendAccount(array $params)
{
    $r = xtreampulsar_api($params, 'POST', '/users/' . rawurlencode($params['username']) . '/status', ['status' => 'DISABLED']);
    return $r['ok'] ? 'success' : $r['error'];
}

function xtreampulsar_UnsuspendAccount(array $params)
{
    $r = xtreampulsar_api($params, 'POST', '/users/' . rawurlencode($params['username']) . '/status', ['status' => 'ACTIVE']);
    return $r['ok'] ? 'success' : $r['error'];
}

function xtreampulsar_TerminateAccount(array $params)
{
    $r = xtreampulsar_api($params, 'DELETE', '/users/' . rawurlencode($params['username']));
    return $r['ok'] ? 'success' : $r['error'];
}

function xtreampulsar_Renew(array $params)
{
    $days = (int) ($params['configoption2'] ?: 30);
    $r = xtreampulsar_api($params, 'POST', '/users/' . rawurlencode($params['username']) . '/extend', ['days' => $days]);
    return $r['ok'] ? 'success' : $r['error'];
}

function xtreampulsar_TestConnection(array $params)
{
    $r = xtreampulsar_api($params, 'GET', '/me');
    if ($r['ok']) {
        return ['success' => true, 'error' => ''];
    }
    return ['success' => false, 'error' => $r['error']];
}

function xtreampulsar_ClientArea(array $params)
{
    $info = xtreampulsar_api($params, 'GET', '/users/' . rawurlencode($params['username']));
    $data = $info['ok'] ? $info['data'] : null;
    return [
        'templatefile' => 'clientarea',
        'vars' => [
            'username' => $params['username'],
            'info' => $data,
        ],
    ];
}
