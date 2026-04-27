
function dashboard({ userName, age, isAdmin, posts }) {
    return `
<div class="main-container">
<p>¡Bienvenido al panel de control!</p>
<p>Usuario actual: ${userName}</p>
<p>Edad calculada en 5 años: ${age + 5}</p>
${ isAdmin ? `
<div class="admin-alert">
<p>Tienes privilegios de administrador.</p>
</div>
` : `
${ age > 18 ? `
<p>Eres un usuario estándar mayor de edad.</p>
` : `
<p>Eres un usuario estándar menor de edad.</p>
` }
` }
<div>

</div>
<table>

<tr>
<td><p>ID</p></td>
<td><p>Nombre</p></td>
<td><p>Rol</p></td>
</tr>

<tr>
<td><p>101</p></td>
<td><p>${userName}</p></td>
<td><p>Admin</p></td>
</tr>
</table>
<img src="profile.png" />
<div class="carousel">
<img src="banner1.jpg"/>
<img src="banner2.jpg"/>
<img src="banner3.jpg"/>
</div>
<div class="post-list">
${ posts.map(post => `
<p>Publicación: ${post}</p>
`).join("") }
</div>
<form>
<label for="user_name_input">Nombre de Usuario</label>
<input type="text" id="user_name_input" value="${userName}" />
<label for="user_age_input">Edad Actual</label>
<input type="number" id="user_age_input" value="${age}" />
<label for="notifications">Recibir notificaciones por correo</label>
<input type="checkbox" id="notifications" checked />

</form>
${ (() => {
switch( undefined ) {
case "Admin":
return `
<p>Modo Dios activado</p>
`;
case "Juan":
return `
<p>Hola Juan, revisa tus mensajes</p>
`;
default:
return `
<p>Hola visitante, por favor actualiza tu perfil</p>
`;
}
})() }
</div>
    `;
}
