#!/bin/bash

# Create a temporary directory for the deployment
temp_dir=$(mktemp -d)

# Copy all files from the client directory to the temp directory
cp -r client/* "$temp_dir/"

# Create a simple index.html for GitHub Pages
echo '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>PulseQ Queue System</title>
    <meta http-equiv="refresh" content="0; url=client/index.html" />
</head>
<body>
    <p>Redirecting to <a href="client/index.html">PulseQ Queue System</a>...</p>
</body>
</html>' > "$temp_dir/index.html"

echo "Files are ready in: $temp_dir"
echo "You can now initialize a git repository in this directory and push to GitHub Pages."
echo "Run these commands:"
echo "cd $temp_dir"
echo "git init"
