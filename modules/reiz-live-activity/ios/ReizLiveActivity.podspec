Pod::Spec.new do |s|
  s.name           = 'ReizLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Fermer les Activités en direct Reiz'
  s.description    = "Ferme la carte du duo (Activité en direct) quand la séance est postée ou que l'heure est passée."
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
