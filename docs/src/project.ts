import project from '../../project.json';

export default project;

export const appOrigin = new URL(project.urls.app).origin;
export const ankiConnectUrl = `http://${project.services.ankiConnect.host}:${project.services.ankiConnect.port}`;
export const webSocketUrl = `ws://${project.services.webSocket.host}:${project.services.webSocket.port}${project.services.webSocket.path}`;
export const webSocketHttpUrl = `http://${project.services.webSocket.host}:${project.services.webSocket.port}`;
