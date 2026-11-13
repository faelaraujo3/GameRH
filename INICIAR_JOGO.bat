@echo off
chcp 65001 > nul
title Circulo Premiado - Servidor da Dinamica
echo ============================================================
echo   CIRCULO PREMIADO - JOGO DE NOVAS ABORDAGENS DE REMUNERACAO
echo ============================================================
echo.
echo Iniciando servidor em http://localhost:3000 ...
echo Painel do Administrador: http://localhost:3000/admin (PIN padrao: 1234)
echo Placar Projetor (Telao): http://localhost:3000/placar
echo.
start "" "http://localhost:3000/admin"
npm run dev
pause
