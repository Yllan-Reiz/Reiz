Pod::Spec.new do |s|
  s.name           = 'ReizEmojiKeyboard'
  s.version        = '1.0.0'
  s.summary        = 'Clavier emoji Reiz'
  s.description    = "Un champ invisible qui ouvre directement le clavier emoji d'Apple pour choisir une réaction."
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
