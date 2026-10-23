Pod::Spec.new do |s|
  s.name           = 'ReizVideoStory'
  s.version        = '1.0.0'
  s.summary        = 'Story vidéo Reiz'
  s.description    = "Assemble la vidéo d'une séance et l'habillage Reiz (PNG) en une vidéo 9:16 à partager en story."
  s.author         = 'Reiz'
  s.homepage       = 'https://reiz-landing.netlify.app'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,swift}"
end
