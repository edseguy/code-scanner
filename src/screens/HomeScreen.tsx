import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import { Camera, CameraView, FlashMode } from 'expo-camera';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'twrnc';

const tw = create({
  theme: {
    extend: {
      colors: {
        'black/50': 'rgba(0, 0, 0, 0.5)',
      },
    },
  },
});

const STORAGE_KEY = '@scan_history';

type ScanItem = {
  type: string;
  data: string;
  timestamp: string;
  result: string | null;
  canOpenURL?: boolean;
};

const CodeScanner = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [zoom, setZoom] = useState(0);
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [scanHistory, setScanHistory] = useState([] as ScanItem[]);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const cameraRef = useRef(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await loadHistory();
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (error) {
        console.error('Error during initialization:', error);
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, []);

  const loadHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedHistory) {
        setScanHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const saveHistory = async (newHistory:object[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  };

  const handleBarCodeScanned = async ({ type, data }:{type:string, data:any}) => {
    setScanned(true);
    const timestamp = new Date().toLocaleString();
    
    const newScan:ScanItem = {
      type,
      data,
      timestamp,
      result: null,
      canOpenURL: false,
    };

    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    console.log("scanned: ", { type, data }, urlPattern.test(data), await Linking.canOpenURL(data));
    if (urlPattern.test(data)) {
      newScan.canOpenURL = await Linking.canOpenURL(data);
      newScan.result = 'URL detectada, toca para abrir';
      if (newScan.canOpenURL) {
        console.log("newScan: ", newScan);
        // if (confirm('¿Deseas abrir esta URL?')) {
        //   Linking.openURL(data);
        // }
        Alert.alert(
          '¿Deseas abrir la URL Detectada?', 
          data, 
          [
          {
            text: 'Cancel',
            onPress: () => console.log('Cancel Pressed'),
            style: 'cancel',
          },
          {text: 'OK', onPress: () => Linking.openURL(data)},
        ]
      );
      }
    }
    
    if (type === 'upc_a' || type === 'ean13') {
      try {
        const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${data}`);
        const productData = await response.json();
        //console.log("productData: ", productData);
        if (productData.items && productData.items.length > 0) {
          //console.log("productData: ", productData.items[0]);
          newScan.result = `Producto: ${productData.items[0].title}`;
        }
      } catch (error) {
        newScan.result = 'No se encontró información del producto';
      }
    }

    const newHistory: ScanItem[] = [newScan, ...scanHistory];
    setScanHistory(newHistory);
    saveHistory(newHistory);
  };

  const toggleFlash = () => {
    setFlashMode(flashMode === 'off' ? 'on' : 'off');
    console.log(flashMode);
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setScanHistory([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const HistoryModal = () => (
    <Modal 
      animationType="slide"
      transparent={true}
      visible={isHistoryModalVisible}
      onRequestClose={() => setIsHistoryModalVisible(false)}
    >
      <View style={tw`flex-1 bg-black/50`}>
        <View style={tw`flex-1 mt-20 bg-white rounded-t-3xl`}>
          <View style={tw`flex-row justify-between items-center p-4 border-b border-gray-200`}>
            <Text style={tw`text-xl font-bold`}>Historial de escaneos</Text>
            <View style={tw`flex-row`}>
              {scanHistory.length > 0 && (
                <TouchableOpacity
                  style={tw`mr-4`}
                  onPress={() => {
                    // if (confirm('¿Estás seguro de borrar todo el historial?')) {
                    //   clearHistory();
                    // }
                    Alert.alert('Confirm', '¿Estás seguro de borrar todo el historial?', [
                      {
                        text: 'Cancel',
                        onPress: () => console.log('Cancel Pressed'),
                        style: 'cancel',
                      },
                      {text: 'OK', onPress: () => {clearHistory();}},
                    ]);
                  }}
                >
                  <MaterialIcons name="delete" size={24} color="red" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={tw`flex-1`}>
            {scanHistory.length === 0 ? (
              <Text style={tw`text-center text-gray-500 mt-8`}>
                No hay escaneos en el historial
              </Text>
            ) : (
              scanHistory.map((scan, index) => (
                <View
                  key={index}
                  style={tw`p-4 border-b border-gray-200`}
                >
                  <View style={tw`flex-row justify-between items-start`}>
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-sm text-gray-500`}>{scan.timestamp}</Text>
                      <Text style={tw`text-base mt-1`}>{scan.data}</Text>
                      {scan?.result && scan.canOpenURL && (
                        <TouchableOpacity onPress={() => Linking.openURL(scan.data)}>
                          <Text style={tw`text-sm text-blue-500 mt-1`}>{scan.result}</Text>
                        </TouchableOpacity>
                      )}
                      {scan?.result && !scan.canOpenURL && (
                        <Text style={tw`text-sm text-blue-500 mt-1`}>{scan.result}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={tw`ml-2`}
                      onPress={() => {
                        Clipboard.setStringAsync(scan?.data);
                        alert('Copiado al portapapeles');
                      }}
                    >
                      <MaterialIcons name="content-copy" size={20} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );  if (!hasPermission && hasPermission !== null) {
    return (
      <View style={tw`flex-1 justify-center items-center p-4`}>
        <Text style={tw`text-center text-lg`}>Sin acceso a la cámara</Text>
        <TouchableOpacity
          style={tw`mt-4 bg-blue-500 px-4 py-2 rounded-full`}
          onPress={async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
          }}
        >
          <Text style={tw`text-white`}>Solicitar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading || hasPermission === null) {
    return (
      <View style={tw`flex-1 justify-center items-center`}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={tw`mt-4 text-center`}>
          {hasPermission === null ? 'Solicitando permiso de cámara...' : 'Cargando...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-gray-100`}>
      {isActive && (
        <View style={tw`flex-1`}>        
        <CameraView
            ref={cameraRef}
            style={tw`flex-1`}
            zoom={zoom}
            flash={flashMode}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'ean8', 'pdf417', 'upc_e', 'code39', 'code128', 'upc_a']
            }}
            onBarcodeScanned= {scanned ? undefined : handleBarCodeScanned}
          >
            <View style={tw`flex-1 p-4 justify-between`}>
              <View style={tw`flex-row justify-between items-center mt-5`}>
                <TouchableOpacity
                  style={tw`bg-black/50 p-2 rounded-full`}
                  onPress={() => setIsActive(false)}
                >
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={tw`bg-black/50 p-2 rounded-full`}
                  onPress={toggleFlash}
                >
                  <MaterialIcons
                    name={flashMode === 'on' ? "flash-on" : "flash-off"}
                    size={24}
                    color="white"
                  />
                </TouchableOpacity>
              </View>
              
              <View style={tw`items-center`}>
                <View style={tw`w-72 h-72 border-2 border-white rounded-lg`} />
              </View>

              <View style={tw`flex-row justify-center items-center`}>
                <TouchableOpacity
                  style={tw`bg-black/50 px-4 py-2 rounded-full`}
                  onPress={() => setZoom(Math.max(0, zoom - 0.1))}
                >
                  <Text style={tw`text-white`}>-</Text>
                </TouchableOpacity>
                <Text style={tw`text-white mx-4`}>{Math.round(zoom * 100)}%</Text>
                <TouchableOpacity
                  style={tw`bg-black/50 px-4 py-2 rounded-full`}
                  onPress={() => setZoom(Math.min(1, zoom + 0.1))}
                >
                  <Text style={tw`text-white`}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        </View>
      )}

      {!isActive && (
        <View style={tw`flex-1 justify-center items-center bg-white`}>
          <TouchableOpacity
            style={tw`bg-blue-500 px-6 py-3 rounded-full`}
            onPress={() => setIsActive(true)}
          >
            <Text style={tw`text-white text-lg`}>Iniciar escáner</Text>
          </TouchableOpacity>
        </View>
      )}

      {scanHistory.length > 0 && (
        <TouchableOpacity
          style={tw`absolute bottom-6 right-6 bg-blue-500 w-14 h-14 rounded-full justify-center items-center shadow-lg`}
          onPress={() => setIsHistoryModalVisible(true)}
        >
          <FontAwesome name="history" size={24} color="white" />
        </TouchableOpacity>
      )}

      <HistoryModal />

      {scanned && (
        <TouchableOpacity
          style={tw`absolute bottom-24 left-1/2 -ml-20 bg-blue-500 px-8 py-3 rounded-full`}
          onPress={() => setScanned(false)}
        >
          <Text style={tw`text-white text-center`}>Escanear de nuevo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default CodeScanner;