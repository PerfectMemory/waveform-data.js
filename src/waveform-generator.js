/**
 * AudioBuffer-based WaveformData generator
 *
 * Adapted from BlockFile::CalcSummary in Audacity, with permission.
 * See https://code.google.com/p/audacity/source/browse/audacity-src/trunk/src/BlockFile.cpp
 */

 var INT8_MAX = 127;
 var INT8_MIN = -128;

 function calculateWaveformDataLength(audio_sample_count, scale) {
   var data_length = Math.floor(audio_sample_count / scale);

   var samples_remaining = audio_sample_count - (data_length * scale);

   if (samples_remaining > 0) {
     data_length++;
   }

   return data_length;
 }

function generateWaveformData(options) {
  var scale = options.scale;
  var amplitude_scale = options.amplitude_scale;
  var split_channels = options.split_channels;
  var length = options.length;
  var sample_rate = options.sample_rate;
  var channels = options.channels.map(function(channel) {
    return new Float32Array(channel);
  });
  var output_channels = split_channels ? channels.length : 1;
  var version = output_channels === 1 ? 1 : 2;
  var header_size = version === 1 ? 20 : 24;
  var data_length = calculateWaveformDataLength(length, scale);
  var total_size = header_size + data_length * 2 * output_channels;
  var buffer = new ArrayBuffer(total_size);
  var data_view = new DataView(buffer);

  var scale_counter = 0;
  var offset = header_size;
  var channel, i;

  var min_value = new Array(output_channels);
  var max_value = new Array(output_channels);

  for (channel = 0; channel < output_channels; channel++) {
    min_value[channel] = Infinity;
    max_value[channel] = -Infinity;
  }

  data_view.setInt32(0, version, true); // Version
  data_view.setUint32(4, 1, true); // Is 8 bit?
  data_view.setInt32(8, sample_rate, true); // Sample rate
  data_view.setInt32(12, scale, true); // Scale
  data_view.setInt32(16, data_length, true); // Length

  if (version === 2) {
    data_view.setInt32(20, output_channels, true);
  }

  for (i = 0; i < length; i++) {
    var sample = 0;

    if (output_channels === 1) {
      for (channel = 0; channel < channels.length; ++channel) {
        sample += channels[channel][i];
      }

      sample = Math.floor(INT8_MAX * sample * amplitude_scale / channels.length);

      if (sample < min_value[0]) {
        min_value[0] = sample;

        if (min_value[0] < INT8_MIN) {
          min_value[0] = INT8_MIN;
        }
      }

      if (sample > max_value[0]) {
        max_value[0] = sample;

        if (max_value[0] > INT8_MAX) {
          max_value[0] = INT8_MAX;
        }
      }
    }
    else {
      for (channel = 0; channel < output_channels; ++channel) {
        sample = Math.floor(INT8_MAX * channels[channel][i] * amplitude_scale);

        if (sample < min_value[channel]) {
          min_value[channel] = sample;

          if (min_value[channel] < INT8_MIN) {
            min_value[channel] = INT8_MIN;
          }
        }

        if (sample > max_value[channel]) {
          max_value[channel] = sample;

          if (max_value[channel] > INT8_MAX) {
            max_value[channel] = INT8_MAX;
          }
        }
      }
    }

    if (++scale_counter === scale) {
      for (channel = 0; channel < output_channels; channel++) {
        data_view.setInt8(offset++, min_value[channel]);
        data_view.setInt8(offset++, max_value[channel]);

        min_value[channel] = Infinity;
        max_value[channel] = -Infinity;
      }

      scale_counter = 0;
    }
  }

  if (scale_counter > 0) {
    for (channel = 0; channel < output_channels; channel++) {
      data_view.setInt8(offset++, min_value[channel]);
      data_view.setInt8(offset++, max_value[channel]);
    }
  }

  return buffer;
}

export { generateWaveformData };
