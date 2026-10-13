"""Original unbranded handheld. Blender 5: --background --python this_file.py.
Meter-scale geometry; front faces -Y in Blender and +Z after glTF export.
All 12 configurable exterior and 8 original internal names are preserved.
"""
import bpy, bmesh, math, json, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models/retro-handheld.glb'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1

def material(name, rgb, rough=.5, metal=0, coat=0):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    # All product surfaces are closed solids, including the hollow housing.
    m.use_backface_culling=True
    p=m.node_tree.nodes.get('Principled BSDF')
    linear=[v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    p.inputs['Base Color'].default_value=(*linear,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    p.inputs['Coat Weight'].default_value=coat
    p.inputs['Coat Roughness'].default_value=.18
    return m

specs={
 'body':((.77,.76,.71),.60,0,0),
 'back_panel':((.77,.76,.71),.60,0,0),
 'screen_bezel':((.14,.16,.15),.37,0,.15),
 'screen':((.38,.48,.34),.28,0,.12),
 'dpad':((.20,.22,.21),.43,0,.1),
 'button_a':((.49,.20,.27),.26,0,.35),
 'button_b':((.49,.20,.27),.26,0,.35),
 'start_button':((.29,.31,.29),.6,0,0),
 'select_button':((.29,.31,.29),.6,0,0),
 'speaker':((.10,.12,.11),.65,0,0),
 'side_buttons':((.25,.27,.25),.45,0,.1),
 'screws':((.31,.33,.32),.3,.75,0),
 'shell_seam':((.38,.40,.37),.72,0,0),
 'battery_latch':((.29,.31,.28),.5,0,0),
 'display_frame':((.07,.09,.08),.46,0,0),
 'screen_glass':((.97,.99,.98),.075,0,0),
 'control_wells':((.20,.22,.20),.54,0,0),
 'status_led':((.61,.77,.44),.22,0,.3),
 'power_switch':((.26,.28,.26),.44,0,.1),
 'volume_wheel':((.24,.26,.24),.47,0,0),
 'accessory_port':((.18,.20,.19),.35,.6,0),
 'rear_vents':((.12,.14,.12),.65,0,0),
 'screw_wells':((.20,.22,.20),.5,0,0),
 'internal_pcb':((.12,.29,.22),.58,.05,0),
 'internal_battery':((.58,.61,.60),.42,.45,0),
 'internal_chip_main':((.075,.085,.08),.6,0,0),
 'internal_chip_power':((.10,.12,.11),.57,0,0),
 'internal_speaker':((.18,.20,.19),.5,.25,0),
 'internal_posts':((.55,.57,.51),.5,.05,0),
 'internal_ribbon':((.66,.40,.17),.42,.25,0),
 'internal_traces':((.58,.48,.24),.38,.55,0),
 'internal_contacts':((.66,.58,.39),.3,.7,0),
 'internal_passives':((.49,.40,.29),.6,0,0),
 'internal_capacitors':((.17,.22,.23),.4,.25,0),
 'internal_solder':((.65,.66,.63),.3,.75,0),
 'internal_battery_connector':((.72,.69,.57),.55,0,0),
 'internal_battery_strap':((.16,.18,.17),.65,0,0),
}
mats={k:material(k+'_material',*v) for k,v in specs.items()}
glass=mats['screen_glass'].node_tree.nodes.get('Principled BSDF')
glass.inputs['Transmission Weight'].default_value=.97
glass.inputs['IOR'].default_value=1.46
led=mats['status_led'].node_tree.nodes.get('Principled BSDF')
led.inputs['Emission Color'].default_value=(.12,.22,.055,1)
led.inputs['Emission Strength'].default_value=.35

# Small bevels and explicit round-rectangle sections avoid high subdivision.
def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj

def normals(obj):
    activate(obj)
    if obj.data.has_custom_normals:
        obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops))
    for poly in obj.data.polygons: poly.use_smooth=True
    mod=obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    mod.keep_sharp=True
    mod.weight=50
    bpy.ops.object.modifier_apply(modifier=mod.name)

def finish(obj,name,bevel=0,segments=3):
    obj.name=name
    activate(obj)
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    if bevel:
        mod=obj.modifiers.new('Edge radius','BEVEL')
        mod.width=bevel
        mod.segments=segments
        bpy.ops.object.modifier_apply(modifier=mod.name)
    normals(obj)
    if name in mats: obj.data.materials.append(mats[name])
    return obj

def box(name,loc,dims,bevel=.0005):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    obj=bpy.context.object
    obj.dimensions=dims
    return finish(obj,name,bevel,segments=1 if min(dims)<.0015 else 3)

def rr_points(w,h,r,n=8):
    result=[]
    for cx,cz,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for i in range(n+1):
            angle=math.radians(start+i*90/n)
            result.append((cx+math.cos(angle)*r,cz+math.sin(angle)*r))
    return result

def rounded(name,loc,dims,r,edge=.0006):
    w,d,h=dims
    e=min(edge,d*.45,r*.45)
    sections=[]
    for step in range(4):
        a=step*math.pi/6
        inset=e*(1-math.sin(a))
        sections.append((-d/2+e*(1-math.cos(a)),inset))
    for step in range(4):
        a=step*math.pi/6
        inset=e*(1-math.cos(a))
        sections.append((d/2-e+e*math.sin(a),inset))
    verts=[]
    for y,inset in sections:
        verts.extend((x,y,z) for x,z in rr_points(w-2*inset,h-2*inset,r-inset,n=6 if max(w,h)>.025 else 4))
    n=len(verts)//len(sections)
    faces=[tuple(range(n-1,-1,-1))]
    for j in range(len(sections)-1):
        for i in range(n): faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    faces.append(tuple(range((len(sections)-1)*n,len(sections)*n)))
    mesh=bpy.data.meshes.new(name+'_geometry')
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    obj.location=loc
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return finish(obj,name)

def cylinder(name,loc,radius,depth,bevel=.0004,axis='Y',vertices=40):
    rotation={'Y':(math.pi/2,0,0),'X':(0,math.pi/2,0),'Z':(0,0,0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc,rotation=rotation)
    return finish(bpy.context.object,name,bevel)

def cut(obj,cutter):
    activate(obj)
    mod=obj.modifiers.new('Machined recess','BOOLEAN')
    mod.operation='DIFFERENCE'
    mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)

def union(obj,addition):
    activate(obj)
    mod=obj.modifiers.new('Moulded support','BOOLEAN')
    mod.operation='UNION'
    mod.object=addition
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(addition,do_unlink=True)

def join(parts,name):
    activate(parts[0])
    for obj in parts: obj.select_set(True)
    bpy.ops.object.join()
    obj=parts[0]
    obj.name=name
    obj.data.materials.clear()
    obj.data.materials.append(mats[name])
    for poly in obj.data.polygons: poly.material_index=0
    return obj

def ring(name,loc,outer,inner,depth,axis='Y'):
    segments=20 if outer<.004 else 40
    obj=cylinder(name,loc,outer,depth,.00018,axis,segments)
    cut(obj,cylinder('cut',loc,inner,depth+.004,0,axis,segments))
    normals(obj)
    return obj

# Two actual hollow housing halves, separated by a 0.6 mm gasket seam.
body=rounded('body',(0,-.0054,0),(.090,.0172,.148),.0086,.0010)
cut(body,rounded('cut',(0,-.002,0),(.085,.018,.143),.0069,.0008))
# Front skin thickness 3 mm; rear half is only 2.5 mm thick.
rear=rounded('back_panel',(0,.0091,0),(.0894,.0106,.1474),.0084,.0011)
cut(rear,rounded('cut',(0,.005,0),(.0844,.014,.1424),.0064,.0006))
# The gasket seats 0.1 mm into each half so its edges cannot leak background.
seam=rounded('shell_seam',(0,.0035,0),(.0885,.0008,.1465),.0083,.0001)
cut(seam,rounded('cut',(0,.0035,0),(.085,.004,.143),.0066,.0002))

# Screen pocket and a four-layer display: bezel / frame / LCD / thin glass.
cut(body,rounded('cut',(0,-.013,.031),(.069,.012,.058),.004,.0006))
bezel=rounded('screen_bezel',(0,-.0145,.030),(.0775,.0056,.0675),.0054,.00065)
cut(bezel,rounded('cut',(0,-.0145,.032),(.066,.013,.052),.003,.0002))
frame=rounded('display_frame',(0,-.0156,.032),(.0666,.0016,.0526),.0033,.00025)
cut(frame,rounded('cut',(0,-.0156,.032),(.0624,.005,.0484),.0022,.0002))
rounded('screen',(0,-.0147,.032),(.0625,.001,.0485),.0022,.00015)
rounded('screen_glass',(0,-.0162,.032),(.0648,.0006,.0508),.0026,.00012)
cylinder('status_led',(.029,-.01765,.001),.00115,.0007,.0002,vertices=24)

# Recessed circular wells and a shallow dished D-pad, not floating controls.
wells=[]
for x,z,r in [(-.022,-.022,.014),(.028,-.016,.0085),(.009,-.029,.0085)]:
    cut(body,cylinder('cut',(x,-.013,z),r,.009,0))
    well=cylinder('control_wells',(x,-.01175,z),r+.0003,.0049,.00018)
    # A blind bore leaves travel clearance behind the moving pivot and buttons.
    cut(well,cylinder('cut',(x,-.013,z),r-.0011,.0054,0))
    wells.append(well)

w,a=.0118,.0042
outline=[(-a,w),(a,w),(a,a),(w,a),(w,-a),(a,-a),(a,-w),(-a,-w),(-a,-a),(-w,-a),(-w,a),(-a,a)]
verts=[(x,y,z) for y in [-.002,.002] for x,z in outline]
n=len(outline)
faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
mesh=bpy.data.meshes.new('dpad_geometry')
mesh.from_pydata(verts,[],faces)
mesh.update()
dpad=bpy.data.objects.new('dpad',mesh)
scene.collection.objects.link(dpad)
dpad.location=(-.022,-.0142,-.022)
activate(dpad)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
finish(dpad,'dpad',.0007)
# Concave thumb seat and an underlying pivot skirt, joined to the same color mesh.
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.011,location=(-.022,-.0266,-.022))
cut(dpad,bpy.context.object)
pivot=cylinder('dpad',(-.022,-.0121,-.022),.009,.0018,.0003)
join([dpad,pivot],'dpad')
for name,x,z in [('button_a',.028,-.016),('button_b',.009,-.029)]:
    button=cylinder(name,(x,-.0146,z),.0069,.0046,.00085,vertices=48)
    # A shallow dished thumb contact, not a flat cylinder cap.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=.023,location=(x,-.0396,z))
    cut(button,bpy.context.object)
for name,x in [('select_button',-.009),('start_button',.012)]:
    cut(body,rounded('cut',(x,-.013,-.046),(.014,.007,.0058),.0024,.0003))
    well=rounded('control_wells',(x,-.0123,-.046),(.0144,.0036,.0062),.0026,.0003)
    cut(well,rounded('cut',(x,-.0133,-.046),(.0123,.0046,.0043),.0018,.0002))
    wells.append(well)
    rounded(name,(x,-.0137,-.046),(.012,.0026,.004),.0017,.0004)
join(wells,'control_wells')

# A tidy two-row array of real perforations above a recessed acoustic cloth plate.
for row in range(2):
    for col in range(7):
        x=-.0195+col*.0065
        z=-.059-row*.004
        cut(body,cylinder('cut',(x,-.012,z),.00115,.008,0,vertices=16))
cloth=rounded('speaker',(0,-.0098,-.061),(.047,.0007,.009),.002,.0002)
# Recessed acoustic ribs seen only through the existing grille perforations.
ribs=[cloth]
for x in [-.018,-.012,-.006,0,.006,.012,.018]:
    ribs.append(box('speaker',(x,-.01025,-.061),(.0005,.00025,.007),.00008))
join(ribs,'speaker')

# Rear battery door fitted into the rear shell, with a reveal and thumbnail latch.
cut(rear,rounded('cut',(0,.012,-.010),(.063,.010,.086),.005,.0003))
# An integral ledge closes the reveal without overlapping the removable door.
lip=rounded('back_panel',(0,.0115,-.010),(.068,.0018,.091),.0075,.0002)
cut(lip,rounded('cut',(0,.0115,-.010),(.0594,.006,.0814),.0032,.0002))
union(rear,lip)
door=rounded('back_panel',(0,.01345,-.010),(.0622,.0018,.0852),.0046,.0003)
# Blind thumb recess: the former through-cut exposed the room around the latch.
cut(door,rounded('cut',(0,.0145,-.048),(.018,.0014,.0038),.0014,.00015))
rounded('battery_latch',(0,.014,-.048),(.014,.0005,.0026),.001,.00015)
# A small upper service ventilation band.
for x in [-.014,-.007,0,.007,.014]:
    cut(rear,rounded('cut',(x,.013,.051),(.003,.007,.009),.001,.0002))
rounded('rear_vents',(0,.0116,.051),(.039,.0008,.015),.002,.0002)
join([rear,door],'back_panel')

# Tactile right power slider, left rocker, and a recessed knurled volume wheel.
# Side detail uses the same understated charcoal, no lettering or branding.
cut(body,box('cut',(.044,-.003,.029),(.008,.0074,.016),.0007))
housing=box('side_buttons',(.0442,-.003,.029),(.0024,.0086,.0174),.0004)
cut(housing,box('cut',(.0452,-.003,.029),(.0024,.0054,.013),.0003))
slider=box('power_switch',(.0451,-.003,.0315),(.0018,.0046,.0052),.00035)
# Shallow grooves stay inside the face instead of cutting through its bevels.
for z in [.0308,.0322]: cut(slider,box('cut',(.046,-.003,z),(.0005,.0034,.00035),0))
# Move the complete wheel pocket forward of the shell joint. The recessed cup
# surrounds and backs the wheel, with only 0.3 mm of working clearance.
wheel_y=-.004
cut(body,cylinder('cut',(-.044,wheel_y,.025),.0061,.008,0,'X'))
wheel_cup=cylinder('side_buttons',(-.0438,wheel_y,.025),.0067,.0026,.00018,'X')
cut(wheel_cup,cylinder('cut',(-.045,wheel_y,.025),.0059,.0032,0,'X'))
join([housing,wheel_cup],'side_buttons')
# A directly modelled knurled rim avoids boolean sliver faces on the old dial.
verts=[]
for x in [-.0454,-.0435]:
    for i in range(64):
        a=i*math.tau/64
        r=.0056 if i%4 in [1,2] else .00535
        verts.append((x,wheel_y+math.cos(a)*r,.025+math.sin(a)*r))
faces=[tuple(range(63,-1,-1)),tuple(range(64,128))]
faces += [(i,(i+1)%64,(i+1)%64+64,i+64) for i in range(64)]
mesh=bpy.data.meshes.new('volume_wheel_geometry')
mesh.from_pydata(verts,[],faces); mesh.update()
wheel=bpy.data.objects.new('volume_wheel',mesh); scene.collection.objects.link(wheel)
finish(wheel,'volume_wheel',.00012,2)
# Circular headphone jack with a blind dark socket; positioned low on the right.
cut(body,cylinder('cut',(.044,-.001,-.046),.0028,.01,0,'X',32))
port=ring('accessory_port',(.0437,-.001,-.046),.0032,.0018,.003,'X')
plug=cylinder('accessory_port',(.0421,-.001,-.046),.0018,.0004,0,'X',24)
join([port,plug],'accessory_port')

# Four service screws in shallow counterbores, with real cross-drive recesses.
screws=[]
screw_wells=[]
for x in [-.033,.033]:
    for z in [-.057,.057]:
        rear=bpy.data.objects['back_panel']
        cut(rear,cylinder('cut',(x,.014,z),.0027,.005,0))
        well=cylinder('screw_wells',(x,.01295,z),.0028,.0019,.0001,vertices=24)
        cut(well,cylinder('cut',(x,.0136,z),.00205,.002,0,vertices=24))
        screw_wells.append(well)
        screw=cylinder('screws',(x,.0136,z),.0019,.0011,.00025,vertices=24)
        for dims in [(.0026,.001,.0005),(.0005,.001,.0026)]:
            cut(screw,box('cut',(x,.01415,z),dims,.00008))
        screws.append(screw)
join(screws,'screws')
join(screw_wells,'screw_wells')

# Interior: real hierarchy of depths, battery behind board, controller chips in
# the lower front, speaker directly behind perforations, ribbon to the display.
pcb=rounded('internal_pcb',(0,-.002,0),(.064,.0014,.119),.004,.00025)
# Shoulder notch clears the volume assembly; lower cutout follows speaker driver.
cut(pcb,rounded('cut',(-.032,-.002,.025),(.007,.006,.019),.002,.00025))
cut(pcb,cylinder('cut',(0,-.002,-.060),.007,.006,0,vertices=24))
for x in [-.027,.027]:
    for z in [-.053,.053]: cut(pcb,cylinder('cut',(x,-.002,z),.0015,.005,0,vertices=16))
rounded('internal_battery',(0,.006,.005),(.049,.007,.069),.003,.001)
strap=rounded('internal_battery_strap',(0,.0097,.005),(.012,.0007,.066),.001,.00015)
rounded('internal_chip_main',(-.005,-.0044,-.020),(.021,.0032,.019),.001,.0003)
rounded('internal_chip_power',(.019,-.0042,-.035),(.010,.0028,.010),.0008,.00025)
# Speaker driver basket and inset central cone remain one internal mesh.
basket=ring('internal_speaker',(0,-.0059,-.054),.008,.0063,.003)
cone=cylinder('internal_speaker',(0,-.005,-.054),.0063,.0014,.0004,vertices=32)
join([basket,cone],'internal_speaker')
# Connector path runs along the right of PCB and returns toward the display.
ribbon=[]
for loc,dims in [((.025,-.004,.013),(.005,.0005,.046)),((.018,-.004,.036),(.019,.0005,.005))]:
    ribbon.append(rounded('internal_ribbon',loc,dims,.0007,.00015))
join(ribbon,'internal_ribbon')
posts=[]
for x in [-.033,.033]:
    for z in [-.057,.057]: posts.append(ring('internal_posts',(x,.001,z),.0025,.0011,.017))
join(posts,'internal_posts')
traces=[]
for x,z,length in [(-.024,-.027,.024),(-.020,-.030,.021),(-.016,-.034,.013),(.012,-.012,.021),(.016,-.010,.017)]:
    traces.append(box('internal_traces',(x,-.00285,z),(.0005,.00018,length),.00007))
    traces.append(box('internal_traces',(x+.002,-.00285,z-length/2),(.0045,.00018,.0005),.00007))
join(traces,'internal_traces')
contacts=[]
# Main chip legs and a four-pin ribbon connector.
for x in [-.016,.006]:
    for z in [-.027,-.023,-.019,-.015]: contacts.append(box('internal_contacts',(x,-.0036,z),(.0016,.0012,.001),.00015))
for x in [.014,.017,.020,.023]: contacts.append(box('internal_contacts',(x,-.0041,.036),(.001,.0004,.005),.0001))
join(contacts,'internal_contacts')
passives=[]
for x,z in [(-.021,-.008),(-.017,-.008),(.013,.001),(.018,.001),(-.022,-.042)]:
    passives.append(box('internal_passives',(x,-.0037,z),(.0025,.0013,.004),.0003))
join(passives,'internal_passives')

# A few readable discrete components, kept out of the display/controls' way.
capacitors=[]
for x,z in [(-.022,.002),(-.022,.011),(.019,-.015)]:
    capacitors.append(cylinder('internal_capacitors',(x,-.005,z),.002,.004,.0002,vertices=20))
join(capacitors,'internal_capacitors')
solder=[]
for x in [-.027,.027]:
    for z in [-.053,.053]:
        solder.append(ring('internal_solder',(x,-.00285,z),.0022,.00145,.00025))
for x,z in [(-.021,-.008),(-.017,-.008),(.013,.001),(.018,.001)]:
    for dz in [-.0025,.0025]:
        solder.append(box('internal_solder',(x,-.003,z+dz),(.0022,.0004,.0008),.0001))
# Small board vias and capacitor contacts, rather than extra floating electronics.
for x,z in [(-.024,-.015),(-.020,-.019),(.012,-.002),(.016,-.002),(.022,.028)]:
    solder.append(ring('internal_solder',(x,-.00285,z),.00065,.00028,.0002))
join(solder,'internal_solder')
connector=rounded('internal_battery_connector',(.017,.002,-.035),(.011,.005,.007),.0007,.0003)
for x in [.014,.017,.020]:
    cut(connector,box('cut',(x,.004,-.035),(.0013,.002,.004),.0002))

# Recalculate after booleans; triangulate explicitly to avoid exporter-dependent
# tessellation across perforated faces. No subdivision modifiers or texture payload.
objects=[o for o in scene.objects if o.type=='MESH']
for obj in objects:
    bm=bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-8)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data); bm.free()
    normals(obj)
    activate(obj)
    tri=obj.modifiers.new('Stable triangulation','TRIANGULATE')
    tri.keep_custom_normals=True
    bpy.ops.object.modifier_apply(modifier=tri.name)
    # Set exact per-corner normals on planar faces AFTER tessellation. This
    # prevents boolean-generated triangles from shading across holes/recesses.
    obj.data.update()
    loop_normals=[tuple(n.vector) for n in obj.data.corner_normals]
    for poly in obj.data.polygons:
        if max(abs(v) for v in poly.normal) > .9999:
            for loop_index in poly.loop_indices: loop_normals[loop_index]=tuple(poly.normal)
        poly.use_smooth=True
    obj.data.normals_split_custom_set(loop_normals)
    if obj.name=='screen':
        uv=obj.data.uv_layers.new(name='LCD_UV')
        for loop in obj.data.loops:
            pos=obj.data.vertices[loop.vertex_index].co
            uv.data[loop.index].uv=(pos.x/.0625+.5,pos.z/.0485+.5)
    obj.data.name=obj.name+'_geometry'
    obj['component']='internal' if obj.name.startswith('internal_') else 'exterior'
points=[o.matrix_world @ Vector(v) for o in objects for v in o.bound_box]
center=Vector([(min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)])
for obj in objects: obj.location-=center
activate(body)
for obj in objects: obj.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
triangles=sum(len(o.data.polygons) for o in objects)
report={'triangles':triangles,'objects':[{'mesh':o.name,'materials':[m.name for m in o.data.materials]} for o in objects]}
print('MODEL_REPORT',json.dumps(report))

# Source and previews; these lights/cameras are never exported into the GLB.
world=scene.world or bpy.data.worlds.new('Preview world')
scene.world=world
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.17,.16,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.6
for loc,power,size in [((-.15,-.22,.28),2,.22),((.19,-.1,.1),1,.16),((0,.18,.2),2,.15)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object
    light.data.energy=power
    light.data.shape='DISK'
    light.data.size=size
    light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(.17,-.37,.19))
camera=bpy.context.object
camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=.205
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.render.resolution_x=900
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scripts/retro-handheld.blend'))
if '--skip-previews' in sys.argv: sys.exit(0)
scene.render.filepath=str(ROOT/'scripts/retro-handheld-preview.png')
bpy.ops.render.render(write_still=True)
camera.location=(-.20,.38,.17)
camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(ROOT/'scripts/retro-handheld-rear-preview.png')
bpy.ops.render.render(write_still=True)
