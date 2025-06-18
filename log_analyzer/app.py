from flask import Flask, render_template, request, jsonify
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Official Unreal Engine log categories (from https://planeshift.top-ix.org/pswiki/index.php/List_of_all_Unreal_Engine_Log_categories)
UE_LOG_CATEGORIES = set([
    'LogPath', 'LogController', 'LogPhysics', 'LogBlueprint', 'LogBlueprintUserMessages',
    'LogAnimation', 'LogRootMotion', 'LogLevel', 'LogSkeletalMesh', 'LogStaticMesh',
    'LogNet', 'LogRep', 'LogNetPlayerMovement', 'LogNetTraffic', 'LogRepTraffic',
    'LogNetFastTArray', 'LogNetDormancy', 'LogSkeletalControl', 'LogSubtitle', 'LogTexture',
    'LogPlayerManagement', 'LogSecurity', 'LogEngineSessionManager', 'LogHAL', 'LogSerialization',
    'LogUnrealMath', 'LogUnrealMatrix', 'LogContentComparisonCommandlet', 'LogNetPackageMap',
    'LogNetSerialization', 'LogMemory', 'LogProfilingDebugging', 'LogCore', 'LogOutputDevice',
    'LogSHA', 'LogStats', 'LogStreaming', 'LogInit', 'LogExit', 'LogExec', 'LogScript',
    'LogLocalization', 'LogLongPackageNames', 'LogProcess', 'LogLoad', 'LogTemp',
    'LogAITestSuite', 'LogBehaviorTreeTest', 'LogAssetTools', 'LogAutomationDriver',
    'LogBlueprintCodeGen', 'LogCollectionManager', 'LogCollisionAnalyzer', 'LogCrashDebugHelper',
    'LogDatasmith', 'LogDerivedDataCache', 'LogDesktopPlatform', 'LogDirectoryWatcher',
    'LogZipArchiveWriter', 'LogFunctionalTest', 'LogGameplayDebug', 'LogHotReload',
    'LogLocalizationService', 'LogMeshDescriptionBuildStatistic', 'LogMeshBuilder',
    'LogMeshDescriptionHelper', 'LogXmpp', 'LogEGL', 'LogOpenGL', 'LogOverlay',
    'PacketHandlerLog', 'LogPakFile', 'LogPerfCounters', 'LogPhysicsCore', 'LogLauncherCheck',
    'LogLauncherPlatform', 'LogRendererCore', 'LogShaderLibrary', 'LogShaders', 'LogDistanceField',
    'LogRenderer', 'LogRHI', 'LogRigVM', 'RuntimeAssetCache', 'SandboxFile', 'LogSignalProcessing',
    'LogSlate', 'LogSlateStyles', 'LogSlateStyle', 'LogMultichannelTCP', 'LogSockets',
    'LogStreamingPlatformFile', 'LogUMG', 'LogUnrealAudio', 'LogUnrealAudioDevice',
    'LogVulkanRHI', 'LogVulkan', 'LogWebBrowser', 'LogD3D11RHI', 'HighlightRecorder',
    'WindowsVideoRecordingSystem', 'MP4', 'WMF', 'WmfRingBuffer', 'LogXAudio2',
    # Additional common categories from the wiki and real logs:
    'LogMaterial', 'LogUObjectGlobals', 'LogLinker', 'LogCook', 'LogAssetRegistry',
    'LogEditor', 'LogWorld', 'LogRender', 'LogAudio', 'LogInput', 'LogShaderCompilers',
    'LogEditorServer', 'LogEngine', 'LogWorldPartition', 'LogWorldPartitionStreaming',
    'LogWorldPartitionActorDesc', 'LogWorldPartitionHLOD', 'LogWorldPartitionStreamingGeneration',
    'LogWorldPartitionStreamingSource', 'LogWorldPartitionStreamingPolicy', 'LogWorldPartitionStreamingCells',
    'LogWorldPartitionStreamingGrid', 'LogWorldPartitionStreamingLayers', 'LogWorldPartitionStreamingManager',
    'LogWorldPartitionStreamingSourceManager', 'LogWorldPartitionStreamingVolume',
    'LogWorldPartitionStreamingVolumeManager', 'LogWorldPartitionStreamingVolumePolicy',
    'LogWorldPartitionStreamingVolumeSource', 'LogWorldPartitionStreamingVolumeSourceManager',
    'LogWorldPartitionStreamingVolumePolicyManager', 'LogWorldPartitionStreamingVolumePolicySource',
    'LogWorldPartitionStreamingVolumePolicySourceManager', 'LogWorldPartitionStreamingVolumePolicyManagerSource',
    'LogWorldPartitionStreamingVolumePolicyManagerSourceManager'
])

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Read and process the log file
        log_entries = []
        log_type_counts = {}
        
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip() and ':' in line:
                    log_type = line.split(':', 1)[0].strip()
                    if log_type in UE_LOG_CATEGORIES:
                        log_type_counts[log_type] = log_type_counts.get(log_type, 0) + 1
                        log_entries.append({
                            'type': log_type,
                            'content': line[len(log_type)+1:].strip()
                        })
        log_types = [ {'type': t, 'count': log_type_counts[t]} for t in sorted(log_type_counts.keys()) ]
        return jsonify({
            'entries': log_entries,
            'log_types': log_types
        })

@app.route('/filter', methods=['POST'])
def filter_logs():
    data = request.get_json()
    selected_types = data.get('types', [])
    
    # Read the log file again
    filename = data.get('filename')
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    filtered_entries = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip() and ':' in line:
                log_type = line.split(':', 1)[0].strip()
                if log_type in UE_LOG_CATEGORIES:
                    if not selected_types or log_type in selected_types:
                        filtered_entries.append({
                            'type': log_type,
                            'content': line[len(log_type)+1:].strip()
                        })
    
    return jsonify({'entries': filtered_entries})

if __name__ == '__main__':
    # Get port from Railway environment variable
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 