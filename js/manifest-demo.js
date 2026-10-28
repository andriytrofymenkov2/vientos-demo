/* Abierta con ?demo: la app que se instala arranca en modo demostración (manifest propio) */
if (/[?&]demo/.test(location.search)) document.querySelector('link[rel=manifest]').href = "manifest-demo.webmanifest";
