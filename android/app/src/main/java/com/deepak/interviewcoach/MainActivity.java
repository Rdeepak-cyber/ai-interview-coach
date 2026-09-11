package com.deepak.interviewcoach;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

import java.util.Arrays;

import androidx.annotation.Nullable;

public class MainActivity extends BridgeActivity {

	private static final int AUDIO_PERMISSION_REQUEST_CODE = 4101;
	private PermissionRequest pendingAudioRequest;

	@Override
	public void onCreate(@Nullable Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		getBridge().getWebView().setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
			@Override
			public void onPermissionRequest(PermissionRequest request) {
				boolean requestsAudio = Arrays.asList(request.getResources())
					.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);

				if (!requestsAudio) {
					super.onPermissionRequest(request);
					return;
				}

				if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
					== PackageManager.PERMISSION_GRANTED) {
					request.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
					return;
				}

				pendingAudioRequest = request;
				requestPermissions(
					new String[] { Manifest.permission.RECORD_AUDIO },
					AUDIO_PERMISSION_REQUEST_CODE
				);
			}
		});
	}

	@Override
	public void onRequestPermissionsResult(
		int requestCode,
		String[] permissions,
		int[] grantResults
	) {
		super.onRequestPermissionsResult(requestCode, permissions, grantResults);

		if (requestCode != AUDIO_PERMISSION_REQUEST_CODE || pendingAudioRequest == null) {
			return;
		}

		PermissionRequest request = pendingAudioRequest;
		pendingAudioRequest = null;

		if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
			request.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
		} else {
			request.deny();
		}
	}

	@Override
	public void onDestroy() {
		if (pendingAudioRequest != null) {
			pendingAudioRequest.deny();
			pendingAudioRequest = null;
		}
		super.onDestroy();
	}
}
