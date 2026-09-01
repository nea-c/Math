data modify storage math: ans set value {angle:0.0f,axis:[0.0f,0.0f,0.0f]}
data modify storage math: ans.angle set compute default float math:quaternion_to_axis_angle/output/stored_angle
data modify storage math: ans.axis[0] set compute default float math:quaternion_to_axis_angle/output/stored_axis_0
data modify storage math: ans.axis[1] set compute default float math:quaternion_to_axis_angle/output/stored_axis_1
data modify storage math: ans.axis[2] set compute default float math:quaternion_to_axis_angle/output/stored_axis_2
return 1
