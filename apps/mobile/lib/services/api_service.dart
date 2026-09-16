import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = 'https://juiceproapi.fando.id/api';
  static const String packageName = 'com.mp3juice.mp3juicepro';
  static const String jamendoClientId = '87c44b11';
  static const String appConfigUrl = 'https://newconfig-bmuj.vercel.app/api/config/com.mp3juice.mp3juicepro?apiKey=rc_6f5fb781ff3ee02b4698403dbae4020c2b0231b9fb5b0b3d';
  
  // Fail-safe default: true until remote config validates otherwise
  static bool isSafeModeActive = true;

  // Countries where IFPI, RIAA, and Google review teams operate
  static const List<String> restrictedCountryCodes = [
    'BE', 'GB', 'UK', 'US', 'DE', 'FR', 'NL', 'IE', 'CA', 'AU', 'CH', 'SE'
  ];

  // High-risk copyrighted artists and major label keywords
  static const List<String> blockedKeywords = [
    'ed sheeran', 'perfect', 'shape of you', 'taylor swift', 'warner',
    'universal music', 'sony music', 'billie eilish', 'the weeknd',
    'dua lipa', 'ariana grande', 'justin bieber', 'drake', 'adele',
    'coldplay', 'bruno mars', 'ifpi', 'riaa'
  ];

  /// Checks if the device is running in a restricted copyright audit jurisdiction
  static bool isDeviceInRestrictedRegion() {
    try {
      final locale = Platform.localeName.toUpperCase();
      for (final code in restrictedCountryCodes) {
        if (locale.endsWith('_$code') || locale.contains('_$code')) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  /// Checks if a query string matches any major label DMCA blacklist
  static bool isKeywordBlacklisted(String query) {
    if (query.isEmpty) return false;
    final q = query.toLowerCase().trim();
    return blockedKeywords.any((keyword) => q.contains(keyword));
  }

  // Fetch App Configuration (Ads, Safe Mode, App Update, etc.)
  static Future<Map<String, dynamic>> fetchAppConfig() async {
    try {
      final response = await http.get(
        Uri.parse(appConfigUrl),
        headers: {
          'x-package-name': packageName,
          'x-device-locale': Platform.localeName,
        },
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        print('Fetched App Config Response: $data');
        if (data is Map<String, dynamic>) {
          Map<String, dynamic> config;
          if (data['data'] != null && data['data'] is Map<String, dynamic>) {
            config = data['data'] as Map<String, dynamic>;
          } else {
            config = data;
          }
          isSafeModeActive = (config['safeMode'] == true) || isDeviceInRestrictedRegion();
          return config;
        }
      }
      // If config fetch fails, stay safe
      isSafeModeActive = true;
      return {};
    } catch (e) {
      print('Error fetching app config: $e');
      isSafeModeActive = true;
      return {};
    }
  }

  // Get Home Categories
  static Future<List<dynamic>> fetchCategories() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/categories'),
        headers: {'x-package-name': packageName},
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] != null) {
          return data['data'] as List<dynamic>;
        }
      }
      return [];
    } catch (e) {
      print('Error fetching categories: $e');
      return [];
    }
  }

  // Fetch dynamic home builder sections
  static Future<List<dynamic>> fetchHomeSections(String? token) async {
    try {
      final headers = <String, String>{'x-package-name': packageName};
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
      final response = await http.get(
        Uri.parse('$baseUrl/home'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] != null) {
          return data['data'] as List<dynamic>;
        }
      }
      return [];
    } catch (e) {
      print('Error fetching home sections: $e');
      return [];
    }
  }

  static Future<List<dynamic>> fetchCategoryTracks(String slug) async {
    if (isSafeModeActive || isDeviceInRestrictedRegion()) {
      return searchJamendoTracks(slug, limit: 20, isTagSearch: true);
    }
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/categories/tracks?slug=$slug&limit=20'),
        headers: {
          'x-package-name': packageName,
          'x-device-locale': Platform.localeName,
        },
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] != null) {
          final resData = data['data'];
          if (resData is Map && resData.containsKey('tracks')) {
            return resData['tracks'] as List<dynamic>;
          } else if (resData is List) {
            return resData;
          }
        }
      }
      return [];
    } catch (e) {
      print('Error fetching category tracks: $e');
      return [];
    }
  }

  // Search Tracks
  static Future<List<dynamic>> searchTracks(String query) async {
    if (query.isEmpty) return [];
    if (isSafeModeActive || isDeviceInRestrictedRegion() || isKeywordBlacklisted(query)) {
      return searchJamendoTracks(query);
    }
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/search?q=${Uri.encodeComponent(query)}&provider=youtube'),
        headers: {
          'x-package-name': packageName,
          'x-device-locale': Platform.localeName,
        },
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] != null) {
          final resData = data['data'];
          if (resData is Map && resData.containsKey('tracks')) {
            return resData['tracks'] as List<dynamic>;
          } else if (resData is List) {
            return resData;
          }
        }
      }
      return [];
    } catch (e) {
      print('Error searching tracks: $e');
      return [];
    }
  }

  // Login
  static Future<Map<String, dynamic>?> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'email': email, 'password': password}),
      );
      final data = json.decode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return data['data'] as Map<String, dynamic>;
      }
      return {'error': data['message'] ?? 'Authentication failed'};
    } catch (e) {
      return {'error': 'Network connection error'};
    }
  }

  // Register
  static Future<Map<String, dynamic>?> register(String username, String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'username': username,
          'displayName': username,
          'email': email,
          'password': password
        }),
      );
      final data = json.decode(response.body);
      if ((response.statusCode == 200 || response.statusCode == 201) && data['success'] == true) {
        return data['data'] as Map<String, dynamic>;
      }
      return {'error': data['message'] ?? 'Registration failed'};
    } catch (e) {
      return {'error': 'Network connection error'};
    }
  }

  // Fetch Play / Stream URL
  static Future<Map<String, dynamic>?> fetchPlayLink(String vid, {String? title, String? artist}) async {
    if (isSafeModeActive || isDeviceInRestrictedRegion() || (title != null && isKeywordBlacklisted(title))) {
      return {
        'blocked': true,
        'message': 'Song is temporarily unavailable.',
      };
    }
    try {
      final queryParams = <String, String>{
        'vid': vid,
        'packageName': packageName,
      };
      if (title != null && title.isNotEmpty) queryParams['title'] = title;
      if (artist != null && artist.isNotEmpty) queryParams['artist'] = artist;

      final uri = Uri.parse('$baseUrl/play').replace(queryParameters: queryParams);
      final response = await http.get(
        uri,
        headers: {
          'x-package-name': packageName,
          'x-device-locale': Platform.localeName,
        },
      );
      
      final data = json.decode(response.body);
      if (response.statusCode == 200) {
        if (data['success'] == true && data['data'] != null) {
          return data['data'] as Map<String, dynamic>;
        }
      } else if (response.statusCode == 403) {
        return {
          'blocked': true,
          'message': data['message'] ?? 'Song is temporarily unavailable.',
        };
      }
      return null;
    } catch (e) {
      print('Error fetching play link: $e');
      return null;
    }
  }

  // Search Jamendo Tracks Helper
  static Future<List<dynamic>> searchJamendoTracks(String query, {int limit = 30, bool isTagSearch = false}) async {
    if (query.isEmpty) return [];
    try {
      final searchParam = isTagSearch ? 'tags' : 'namesearch';
      final url = 'https://api.jamendo.com/v3.0/tracks/?client_id=$jamendoClientId&format=json&$searchParam=${Uri.encodeComponent(query)}&limit=$limit';
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['results'] != null) {
          final List<dynamic> results = data['results'];
          return results.map((item) => {
            'id': item['id'].toString(),
            'vid': item['id'].toString(),
            'title': item['name'] ?? 'Unknown Title',
            'artist': item['artist_name'] ?? 'Unknown Artist',
            'cover': item['image'] ?? '',
            'url': 'https://api.jamendo.com/v3.0/tracks/file/?client_id=$jamendoClientId&id=${item['id']}&action=stream',
            'duration': item['duration'] ?? 0,
            'provider': 'jamendo',
          }).toList();
        }
      }
      return [];
    } catch (e) {
      print('Error searching Jamendo tracks: $e');
      return [];
    }
  }

  // Fetch Top/Popular Jamendo Tracks
  static Future<List<dynamic>> fetchTopJamendoTracks({int limit = 30}) async {
    try {
      final url = 'https://api.jamendo.com/v3.0/tracks/?client_id=$jamendoClientId&format=json&order=popularity_total&limit=$limit';
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['results'] != null) {
          final List<dynamic> results = data['results'];
          return results.map((item) => {
            'id': item['id'].toString(),
            'vid': item['id'].toString(),
            'title': item['name'] ?? 'Unknown Title',
            'artist': item['artist_name'] ?? 'Unknown Artist',
            'cover': item['image'] ?? '',
            'url': 'https://api.jamendo.com/v3.0/tracks/file/?client_id=$jamendoClientId&id=${item['id']}&action=stream',
            'duration': item['duration'] ?? 0,
            'provider': 'jamendo',
          }).toList();
        }
      }
      return [];
    } catch (e) {
      print('Error fetching Top Jamendo tracks: $e');
      return [];
    }
  }
}
