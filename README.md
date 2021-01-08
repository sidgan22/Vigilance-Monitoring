# Driver-Vigilance-EEG


Ionic Setup

Install JDK, Windows SDK, Gradle, Android SDK (Android Studio)

Install node.js
Install GitHub (GitBash)
Install VisualStudioCode

Inside VisualStudioCode in a terminal:
npm install -g cordova
npm install -g ionic
npm install -g native-run
npm install -g cordova-res
npm install -g @angular/core
npm install -g @angular/forms
npm install -g @angular/router
npm install -g rxjs
npm install -g rxjs@5.5.0
npm install -g rxjs@6.5.0
npm install -g @ionic-native/core
npm install -g @ionic-native/core@5.1.0
npm install -g @ionic-native/file
npm install -g @ionic/pwa-elements
npm install -g @ionic-native/ble
npm add @ionic/angular
npm add @ionic/react

Project start:
ionic start myapp tabs --type=angular --capacitor

Inside project folder (cd projectfolder in terminal):

ionic cordova platform add android
ionic cordova platforms add windows
ionic cordova platform add browser

ionic cordova plugin add cordova-plugin-inappbrowser
ionic cordova plugin add cordova-plugin-ble-central

npm install --save @ionic-native/ble






