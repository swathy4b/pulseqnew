"""
Test script to verify the health check endpoint.
"""
import requests
import sys

def test_health_endpoint(host='http://localhost:5000'):
    """Test the health check endpoint."""
    try:
        url = f"{host}/health"
        print(f"Testing health endpoint at: {url}")
        
        response = requests.get(url, timeout=5)
        print(f"Status Code: {response.status_code}")
        print("Response:")
        print(response.json())
        
        if response.status_code == 200:
            print("✅ Health check passed!")
            return True
        else:
            print("❌ Health check failed!")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error testing health endpoint: {str(e)}")
        return False

if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5000'
    success = test_health_endpoint(host)
    sys.exit(0 if success else 1)
